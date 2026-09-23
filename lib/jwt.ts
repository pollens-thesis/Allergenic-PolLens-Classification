// Reading JWT claims client-side. Nothing here verifies a signature — the
// backend does that on every request. It is only used to read `email` from
// Google's ID token and `exp` from our own tokens, so the app can refresh
// before a token expires instead of waiting for a 401.

/** A JWT's payload, or `{}` if the token is malformed. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Whether `token` is missing, malformed, or expires within `skewSeconds`.
 * A small skew means a request never leaves with a token that dies in flight.
 */
export function isExpired(token: string | undefined, skewSeconds = 0): boolean {
  if (!token) return true;
  const exp = decodeJwtPayload(token).exp;
  if (typeof exp !== "number") return true;
  return exp * 1000 <= Date.now() + skewSeconds * 1000;
}
