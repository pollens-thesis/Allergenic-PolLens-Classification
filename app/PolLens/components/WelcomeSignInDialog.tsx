"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import SignInForm from "@/components/SignInForm";
import { BRAND_NAME } from "@/lib/brand";

const OpenSignInContext = createContext<(() => void) | null>(null);

function subscribeToLocation(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}

function getLocationSearch() {
  return window.location.search;
}

export function WelcomeSignInProvider({ children }: { children: ReactNode }) {
  const search = useSyncExternalStore(subscribeToLocation, getLocationSearch, () => "");
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const [dismissedSearch, setDismissedSearch] = useState<string | null>(null);
  const params = new URLSearchParams(search);
  const shouldOpenForRedirect = params.has("next") || params.get("reason") === "expired";
  const open = manuallyOpened || (shouldOpenForRedirect && dismissedSearch !== search);

  function handleOpenChange(nextOpen: boolean) {
    setManuallyOpened(nextOpen);
    if (nextOpen) setDismissedSearch(null);
    else if (shouldOpenForRedirect) setDismissedSearch(search);
  }

  return (
    <OpenSignInContext.Provider value={() => setManuallyOpened(true)}>
      {children}
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        {open && (
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
            <Dialog.Popup className="card-panel fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw_-_1rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-3 outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 sm:p-5">
              <Dialog.Close
                aria-label="Close Sign In"
                className="focus-ring absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
              >
                <X aria-hidden="true" size={17} strokeWidth={1.75} />
              </Dialog.Close>

              <Dialog.Title className="t-plate-title pr-12 text-text">
                Sign In To {BRAND_NAME}
              </Dialog.Title>
              <Dialog.Description className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-text-muted">
                Continue with the account you use for your research.
              </Dialog.Description>

              <div className="mt-5 border-t border-border pt-4">
                <SignInForm />
              </div>
              <p className="mt-5 border-t border-border pt-3 text-[12px] leading-relaxed text-text-muted">
                Sign in with a Google account or a Microsoft work or school account.
              </p>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </OpenSignInContext.Provider>
  );
}

export function WelcomeSignInButton({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const openSignIn = useContext(OpenSignInContext);
  if (!openSignIn) throw new Error("WelcomeSignInButton must be inside WelcomeSignInProvider.");

  return (
    <button type="button" onClick={openSignIn} className={className}>
      {children}
    </button>
  );
}
