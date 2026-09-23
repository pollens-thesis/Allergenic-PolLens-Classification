"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import GoogleIcon from "@/components/GoogleIcon";
import { exchangeGoogleCredential, GoogleSignInError } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";

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
          .then(({ email, tokens }) => {
            updateSettings({ email, accessToken: tokens.access, refreshToken: tokens.refresh });
            router.push("/dashboard");
          })
          .catch((err: unknown) => {
            const message = err instanceof GoogleSignInError ? err.message : "Google sign-in failed.";
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

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />

      {!choosing ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="focus-ring flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-text transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-border-strong active:scale-[0.98]"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      ) : (
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <GoogleIcon />
            <span className="text-[13px] font-medium text-text">Choose an Account</span>
          </div>

          {configured ? (
            <div ref={buttonSlotRef} className="flex min-h-[44px] items-center justify-center" />
          ) : (
            <p className="text-[12.5px] text-danger">
              Google sign-in is not configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID).
            </p>
          )}

          {pending && <p className="mt-2 text-[12.5px] text-text-muted">Signing in…</p>}
          {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}

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
