// ---------------------------------------------------------------------------
// MICROSOFT SIGN-IN — work/school accounts (e.g. up.edu.ph's Microsoft 365).
//
// MSAL opens Microsoft's own sign-in popup and returns an ID token, which the
// backend verifies (POST /api/v1/auth/microsoft/) and exchanges for our JWT
// pair — the same session as Google sign-in. The popup lands on
// /auth/microsoft (app/auth/microsoft), which hands the response back here.
// Loaded on demand, so the library only downloads when someone uses it.
// ---------------------------------------------------------------------------

import type { PublicClientApplication } from "@azure/msal-browser";

const CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID ?? "";

export const microsoftConfigured = Boolean(CLIENT_ID);

let appPromise: Promise<PublicClientApplication> | null = null;

function msalApp(): Promise<PublicClientApplication> {
  appPromise ??= import("@azure/msal-browser").then(async ({ PublicClientApplication }) => {
    const app = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        // Any work or school account; the backend's allowlist decides who gets in.
        authority: "https://login.microsoftonline.com/organizations",
        redirectUri: `${window.location.origin}/auth/microsoft`,
      },
      // MSAL's own cache only needs to outlive the popup; our session is separate.
      cache: { cacheLocation: "sessionStorage" },
    });
    await app.initialize();
    return app;
  });
  return appPromise;
}

/** Opens Microsoft's account picker and returns the signed ID token. */
export async function signInWithMicrosoft(): Promise<string> {
  const app = await msalApp();
  const result = await app.loginPopup({
    scopes: ["openid", "profile", "email"],
    prompt: "select_account",
  });
  return result.idToken;
}

/** Forget MSAL's cached account (on sign-out), if MSAL was ever loaded. */
export async function clearMicrosoftCache(): Promise<void> {
  if (!appPromise) return;
  try {
    await (await appPromise).clearCache();
  } catch {
    // Nothing cached to clear.
  }
}
