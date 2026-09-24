// ---------------------------------------------------------------------------
// GOOGLE SIGN-IN — trading a Google ID token for our own session.
//
// SignInForm loads the Google Identity Services script and renders Google's
// own account-chooser button; once someone picks an account, GIS calls back
// with a signed ID token (the `credential`). That token is opaque to us —
// only the backend verifies its signature — so this module just does the
// round trip to POST /api/v1/auth/google/ and reads back the email claim the
// rest of the app already expects (see lib/account.ts, lib/settings.ts).
// ---------------------------------------------------------------------------

import { API_BASE_URL } from "@/lib/config";
import { decodeJwtPayload } from "@/lib/jwt";

export type GoogleTokenPair = {
  access: string;
  refresh: string;
};

export class GoogleSignInError extends Error {}

/**
 * Exchanges a Google ID token (the `credential` from GIS's callback) for our
 * own JWT pair, and reads back the signed-in account's email.
 */
export async function exchangeGoogleCredential(
  credential: string,
): Promise<{ email: string; tokens: GoogleTokenPair }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: credential }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new GoogleSignInError(
      typeof body?.detail === "string" ? body.detail : "Google sign-in failed.",
    );
  }

  const tokens = (await res.json()) as GoogleTokenPair;
  const claims = decodeJwtPayload(credential);
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email) {
    throw new GoogleSignInError("Google did not return an email address.");
  }

  return { email, tokens };
}

/**
 * Exchanges a Microsoft ID token (from lib/microsoft.ts) for our JWT pair. The
 * account's sign-in name (`preferred_username`) is what the backend keys the
 * user on, so it's what the rest of the app shows as the email.
 */
export async function exchangeMicrosoftIdToken(
  idToken: string,
): Promise<{ email: string; tokens: GoogleTokenPair }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/microsoft/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new GoogleSignInError(
      typeof body?.detail === "string" ? body.detail : "Microsoft sign-in failed.",
    );
  }

  const tokens = (await res.json()) as GoogleTokenPair;
  const claims = decodeJwtPayload(idToken);
  const email = typeof claims.preferred_username === "string" ? claims.preferred_username.toLowerCase() : "";
  if (!email) throw new GoogleSignInError("Microsoft did not return a sign-in name.");
  return { email, tokens };
}
