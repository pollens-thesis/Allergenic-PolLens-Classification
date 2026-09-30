"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import GoogleIcon from "@/components/GoogleIcon";
import { exchangeGoogleCredential, exchangeMicrosoftIdToken, GoogleSignInError } from "@/lib/auth";
import { microsoftConfigured, signInWithMicrosoft } from "@/lib/microsoft";
import MicrosoftIcon from "@/components/MicrosoftIcon";
import { updateSettings, useSettings } from "@/lib/settings";
import { isSignedIn, safeNext } from "@/lib/session";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const noopSubscribe = () => () => {};

/** Whether we were sent here because the session ran out (see lib/api.ts). */
function useSessionExpired(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("reason") === "expired",
    () => false,
  );
}

/** The page to land on after sign-in — `?next=` if it's a safe local path. */
function nextPage(): string {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

/**
 * Google's own account chooser, not ours — GIS owns its trust chrome, so the
 * "Continue with Google" button only reveals a slot that the Google
 * Identity Services script renders its real button into. Picking an account
 * calls back with a signed ID token, which lib/auth.ts hands to the backend
 * for verification and JWT issuance; only that round trip decides who is
 * actually signed in.
 */
export default function SignInForm() {
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonSlotRef = useRef<HTMLDivElement>(null);
  const configured = Boolean(GOOGLE_CLIENT_ID);
  const settings = useSettings();
  const signedIn = isSignedIn(settings);
  const expired = useSessionExpired();

  // Already signed in (or just signed in from another tab): skip the form.
  useEffect(() => {
    if (signedIn) router.replace(nextPage());
  }, [signedIn, router]);

  useEffect(() => {
    if (!choosing || !scriptReady || !configured || !buttonSlotRef.current || !window.google) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        setPending(true);
        setError(null);
        exchangeGoogleCredential(response.credential)
          .then(({ email, name, tokens }) => {
            // The signedIn effect above navigates once the session is stored.
            updateSettings({ email, name, accessToken: tokens.access, refreshToken: tokens.refresh });
          })
          .catch((err: unknown) => {
            const message =
              err instanceof GoogleSignInError
                ? err.message
                : "Google sign-in failed. Try again, or use your up.edu.ph or mseuf.edu.ph account.";
            setError(message);
            setPending(false);
            toast.error(message);
          });
      },
    });
    window.google.accounts.id.renderButton(buttonSlotRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: 280,
    });
  }, [choosing, scriptReady, configured, router]);

  async function handleMicrosoft() {
    setPending(true);
    setError(null);
    try {
      const idToken = await signInWithMicrosoft();
      const { email, name, tokens } = await exchangeMicrosoftIdToken(idToken);
      updateSettings({ email, name, accessToken: tokens.access, refreshToken: tokens.refresh });
    } catch (err: unknown) {
      setPending(false);
      // Closing Microsoft's window is a choice, not an error.
      const code = (err as { errorCode?: string } | null)?.errorCode;
      if (code === "user_cancelled" || code === "popup_window_error") return;
      const message =
        err instanceof GoogleSignInError
          ? err.message
          : "Microsoft sign-in failed. Try again, or use your up.edu.ph or mseuf.edu.ph account.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <>
      {expired && (
        <p className="mb-3 rounded-md border border-processing/30 bg-processing-bg px-3 py-2 text-[13.5px] leading-relaxed text-processing">
          Your session expired — sign in again to pick up where you left off.
        </p>
      )}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />

      {!choosing ? (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setChoosing(true)}
            disabled={pending}
            className="focus-ring flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-text transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-border-strong active:scale-[0.98] disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          {microsoftConfigured && (
            <button
              type="button"
              onClick={() => void handleMicrosoft()}
              disabled={pending}
              className="focus-ring flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-text transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-border-strong active:scale-[0.98] disabled:opacity-50"
            >
              <MicrosoftIcon />
              {pending ? "Signing in…" : "Continue with Microsoft"}
            </button>
          )}
          {error && <p className="text-[13.5px] text-danger">{error}</p>}
        </div>
      ) : (
        <div className="border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2.5">
            <GoogleIcon />
            <span className="text-[13px] font-medium text-text">Choose an Account</span>
          </div>

          {configured ? (
            <div ref={buttonSlotRef} className="flex min-h-[44px] items-center justify-center" />
          ) : (
            <p className="text-[13.5px] text-danger">
              Google sign-in isn&apos;t available right now. Use Microsoft, or contact the PolLens team.
            </p>
          )}

          {pending && <p className="mt-2 text-[13.5px] text-text-muted">Signing in…</p>}
          {error && <p className="mt-2 text-[13.5px] text-danger">{error}</p>}

          <button
            type="button"
            onClick={() => setChoosing(false)}
            className="focus-ring mt-3.5 inline-flex items-center gap-1 rounded-md px-2 py-2 text-[13px] text-text-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text active:scale-[0.98]"
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
            Back
          </button>
        </div>
      )}
    </>
  );
}
