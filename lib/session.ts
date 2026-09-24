// ---------------------------------------------------------------------------
// SESSION — who counts as signed in, where to go after sign-in, signing out.
// Token refresh itself lives in lib/api.ts.
// ---------------------------------------------------------------------------

import { API_BASE_URL, validAccessToken } from "@/lib/api";
import { isExpired } from "@/lib/jwt";
import { getSnapshot, resetSettings, type Settings } from "@/lib/settings";

/** Signed in = a refresh token that hasn't expired (the access token is renewed from it). */
export function isSignedIn(settings: Settings): boolean {
  return !isExpired(settings.refreshToken);
}

/**
 * Where to send someone after sign-in: the `next` page they were bounced from,
 * if it is a path on this site — never an absolute or protocol-relative URL
 * (an open redirect) — else the dashboard.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next === "/" ? "/dashboard" : next;
}

const LOGOUT_TIMEOUT_MS = 4000;

/**
 * Revoke the refresh token on the server, then forget the session locally.
 * The server call is best-effort: offline, slow or already-expired sessions
 * still sign out of this browser — a failed request must never leave someone
 * stuck signed in on their own machine.
 */
export async function signOut(): Promise<void> {
  const { refreshToken } = getSnapshot();
  if (refreshToken && !isExpired(refreshToken)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
    try {
      // Renew the access token first (logout needs one), *then* read the
      // refresh token — renewing rotates it, and revoking the old one would fail.
      const access = await validAccessToken();
      await fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ refresh: getSnapshot().refreshToken }),
        signal: controller.signal,
      });
    } catch {
      // Best-effort — fall through to the local sign-out.
    } finally {
      clearTimeout(timer);
    }
  }
  // Forget the Microsoft account too, so the next person on this browser picks their own.
  await import("@/lib/microsoft").then(({ clearMicrosoftCache }) => clearMicrosoftCache());
  resetSettings();
}
