"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Fragment } from "react";

export const SECTION_SHORTCUTS = [
  { key: "d", label: "Dashboard", href: "/dashboard" },
  { key: "a", label: "Analyze Specimen", href: "/upload" },
  { key: "r", label: "Reports", href: "/reports" },
  { key: "m", label: "Pollen Map", href: "/map" },
  { key: "l", label: "Allergen Reference", href: "/dataset" },
  { key: "s", label: "Account & Settings", href: "/settings" },
] as const;

export default function HelpAboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw_-_2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 sm:p-6">
          <Dialog.Close
            aria-label="Close Help & About"
            className="focus-ring absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
          >
            <X size={17} strokeWidth={1.75} />
          </Dialog.Close>

          <Dialog.Title className="pr-12 text-[1.65rem] leading-tight font-semibold tracking-tight text-text">
            Help &amp; About
          </Dialog.Title>
          <Dialog.Description className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-text-muted">
            PolLens helps researchers analyze microscope slide images, review pollen readings, and maintain collection
            reports.
          </Dialog.Description>

          <section className="mt-5 border-t border-border pt-4" aria-labelledby="help-shortcuts-title">
            <h3 id="help-shortcuts-title" className="text-[15px] font-semibold text-text">
              Keyboard Shortcuts
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              Press G, then a section letter within one second.
            </p>
            <dl className="mt-3 grid grid-cols-[minmax(7.5rem,auto)_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="flex items-center gap-1.5">
                <KeyCap>?</KeyCap>
              </dt>
              <dd className="self-center text-text">Open Help &amp; About</dd>
              {SECTION_SHORTCUTS.map((shortcut) => (
                <Fragment key={shortcut.key}>
                  <dt className="flex items-center gap-1.5">
                    <KeyCap>G</KeyCap>
                    <span className="text-[12px] text-text-faint">then</span>
                    <KeyCap>{shortcut.key.toUpperCase()}</KeyCap>
                  </dt>
                  <dd className="self-center text-text">{shortcut.label}</dd>
                </Fragment>
              ))}
            </dl>
          </section>

          <section className="mt-5 border-t border-border pt-4" aria-labelledby="help-detection-title">
            <h3 id="help-detection-title" className="text-[15px] font-semibold text-text">
              Detection Status
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              The trained detection model is not deployed yet. Analyses use built-in sample readings, which are labeled
              <span className="mx-1 inline-flex items-center border border-dashed border-processing/50 px-1.5 py-0.5 align-middle text-[12px] font-medium text-processing">
                Sample
              </span>
              throughout the app.
            </p>
          </section>

          <p className="mt-5 border-t border-border pt-3 text-[12px] text-text-faint">
            PolLens · Research Console
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-sm border border-border bg-surface-sunken px-1.5 py-0.5 text-[12px] leading-5 text-text">
      {children}
    </kbd>
  );
}
