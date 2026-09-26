"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function MicrosoftRedirectBridge() {
  useEffect(() => {
    import("@azure/msal-browser/redirect-bridge")
      .then(({ broadcastResponseToMainFrame }) => broadcastResponseToMainFrame())
      .catch(() => {
        // Opened directly, or the response was malformed: nothing to hand back.
      });
  }, []);

  // Same centred status as the session check, so the hand-off doesn't flash an unstyled page.
  return (
    <div className="flex min-h-screen w-full items-center justify-center gap-2 bg-bg text-[13px] text-text-muted">
      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
      Completing Microsoft sign-in…
    </div>
  );
}
