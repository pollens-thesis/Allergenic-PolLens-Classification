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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type GoogleTokenPair = {
  access: string;
  refresh: string;
};

export class GoogleSignInError extends Error {}

/** Reads a JWT's payload without verifying it — the backend already did that. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

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
