// ---------------------------------------------------------------------------
// AUTHENTICATED FETCH — the session layer every backend call goes through.
//
// The backend issues a 15-minute access token and a 7-day refresh token, with
// rotation: each refresh returns a new pair and blacklists the old refresh
// token (api/config/settings.py SIMPLE_JWT). `apiFetch` keeps that invisible:
//
//   * attaches `Authorization: Bearer <access>`;
//   * refreshes *before* sending when the access token is about to expire, so
//     a multipart upload isn't sent twice just to learn it was unauthorised;
//   * on a 401 anyway, refreshes once and retries once;
//   * if the refresh itself is rejected, the session is over: it is cleared,
//     the researcher is told, and sent to sign in (then back here).
//
// Network failures are not treated as a lost session — they throw as usual,
// and callers keep their existing fallbacks.
// ---------------------------------------------------------------------------

import { toast } from "sonner";
import { isExpired } from "@/lib/jwt";
import { getSnapshot, resetSettings, updateSettings } from "@/lib/settings";

import { API_BASE_URL } from "@/lib/config";

export { API_BASE_URL };

/** Refresh when the access token has less than this left. */
const REFRESH_SKEW_SECONDS = 30;

/** The session is gone (never signed in, or the refresh token was rejected). */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Sign in again.");
    this.name = "SessionExpiredError";
  }
}

let refreshInFlight: Promise<string> | null = null;
let ending = false;

/** Clears the session, says so once, and sends the researcher to sign in. */
function endSession(): never {
  if (!ending && typeof window !== "undefined") {
    ending = true;
    resetSettings();
    toast.error("Your session expired — sign in again.");
    const next = window.location.pathname + window.location.search;
    // The toast is lost with the page; ?reason= lets the sign-in page say why.
    window.location.assign(`/?next=${encodeURIComponent(next)}&reason=expired`);
  }
  throw new SessionExpiredError();
}

async function requestNewPair(refreshToken: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (res.status === 401 || res.status === 400) endSession();
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}).`);
  const { access, refresh } = (await res.json()) as { access: string; refresh?: string };
  // Rotation: the old refresh token is now blacklisted, so the new one must be kept.
  updateSettings({ accessToken: access, refreshToken: refresh ?? refreshToken });
  return access;
}

/**
 * A fresh access token. One refresh at a time per tab (concurrent callers
 * share it) and, where the browser supports Web Locks, per browser — two tabs
 * refreshing with the same rotating token would get the second one rejected
 * and sign the researcher out for no reason. Inside the lock, storage is
 * re-read first: if another tab already rotated the pair, that pair is used.
 */
export function refreshSession(staleRefresh: string | undefined): Promise<string> {
  refreshInFlight ??= (async () => {
    const run = async () => {
      const current = getSnapshot();
      if (!current.refreshToken || isExpired(current.refreshToken)) endSession();
      if (
        current.refreshToken !== staleRefresh &&
        current.accessToken &&
        !isExpired(current.accessToken, REFRESH_SKEW_SECONDS)
      ) {
        return current.accessToken; // another tab already refreshed
      }
      return requestNewPair(current.refreshToken);
    };
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    return locks ? locks.request("pollens-token-refresh", run) : run();
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** A usable access token, refreshing first if it's about to expire. */
export async function validAccessToken(): Promise<string> {
  const { accessToken, refreshToken } = getSnapshot();
  if (!refreshToken) endSession();
  if (accessToken && !isExpired(accessToken, REFRESH_SKEW_SECONDS)) return accessToken;
  return refreshSession(refreshToken);
}

/**
 * `fetch` against the backend as the signed-in researcher. `path` is relative
 * to the API origin, e.g. "/api/v1/reports/". Throws `SessionExpiredError`
 * (after redirecting to sign-in) when there is no usable session.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  };

  const token = await validAccessToken();
  const res = await send(token);
  if (res.status !== 401) return res;

  // Rejected despite looking valid (revoked, clock skew): refresh once, retry once.
  const retryToken = await refreshSession(getSnapshot().refreshToken);
  const retry = await send(retryToken);
  if (retry.status === 401) endSession();
  return retry;
}

/** Whether a stored session exists that can still be refreshed. */
export function hasSession(): boolean {
  return !isExpired(getSnapshot().refreshToken);
}
