"use client";

import { useEffect } from "react";

export default function MicrosoftRedirectBridge() {
  useEffect(() => {
    import("@azure/msal-browser/redirect-bridge")
      .then(({ broadcastResponseToMainFrame }) => broadcastResponseToMainFrame())
      .catch(() => {
        // Opened directly, or the response was malformed: nothing to hand back.
      });
  }, []);

  return <p className="p-6 text-[13px] text-text-muted">Completing Microsoft sign-in…</p>;
}
