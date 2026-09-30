"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  LayoutGrid,
  ScanLine,
  FileText,
  Map,
  Leaf,
  Menu,
  Settings,
  X,
  CircleHelp,
} from "lucide-react";
import { displayName, getInitials } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import HelpAboutDialog, { SECTION_SHORTCUTS } from "@/components/HelpAboutDialog";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/upload", label: "Analyze Specimen", icon: ScanLine },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/map", label: "Pollen Map", icon: Map },
  { href: "/dataset", label: "Allergen Reference", icon: Leaf },
];

// Settings is deliberately absent from the nav: the account card at the bottom
// is the way in, so the same destination isn't offered twice.
const SETTINGS_HREF = "/settings";

/** The PolLens mark, shown in the rail and in the mobile bar. */
function Wordmark() {
  return (
    <Image
      src="/brand/pollens-logo.png"
      alt="PolLens"
      width={2172}
      height={724}
      className="block h-auto w-[165px] shrink-0 lg:w-[192px]"
    />
  );
}

/**
 * Navigation, in two shapes for two sizes.
 *
 * Wide screens get the pinned rail. Narrow ones get a fixed bar and a drawer —
 * the rail's labels ("Analyze specimen", "Allergen reference") are what make the
 * console navigable, and a row of icons at the foot of a phone would have to
 * drop them. Both render the same links from the same list, so a new section is
 * added once.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const settings = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const sequencePending = useRef(false);
  const sequenceTimer = useRef<number | null>(null);

  // The person's name from their account; the second line says where the card goes.
  const name = displayName(settings);

  // While the drawer is over the page, the page behind it should not scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // A short G → section sequence keeps navigation quick without stealing
  // ordinary letters from pages or from fields where the researcher is typing.
  useEffect(() => {
    const clearSequence = () => {
      sequencePending.current = false;
      if (sequenceTimer.current !== null) {
        window.clearTimeout(sequenceTimer.current);
        sequenceTimer.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const element = target instanceof HTMLElement ? target : null;
      const isTyping =
        element?.isContentEditable ||
        Boolean(element?.closest("input, textarea, select, [role='textbox'], [contenteditable='true']"));

      if (
        isTyping ||
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        helpOpen ||
        element?.closest("[role='dialog'], [role='alertdialog']")
      ) {
        return;
      }

      if (event.key === "Escape") {
        clearSequence();
        return;
      }

      if (event.key === "?") {
        clearSequence();
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (sequencePending.current) {
        clearSequence();
        const destination = SECTION_SHORTCUTS.find((shortcut) => shortcut.key === event.key.toLowerCase());
        if (destination) {
          event.preventDefault();
          setMenuOpen(false);
          router.push(destination.href);
        }
        return;
      }

      if (event.key.toLowerCase() === "g" && !event.repeat) {
        sequencePending.current = true;
        sequenceTimer.current = window.setTimeout(clearSequence, 1000);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearSequence();
    };
  }, [helpOpen, router]);

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        // A section's own pages count as that section, so the tab stays
        // lit on /reports/PLN-2026-0142 and on /upload/result.
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const ItemIcon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // Choosing a destination is the end of navigating, so the drawer
            // goes with the click rather than waiting on the route to change.
            onClick={() => setMenuOpen(false)}
            className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
              active
                ? "bg-surface-sunken text-text"
                : "text-text-muted hover:bg-surface-sunken hover:text-text"
            }`}
          >
            <ItemIcon size={16} strokeWidth={1.75} className={active ? "text-text" : ""} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  // Account and Settings are one entry: the card is the link.
  const accountCard = (
    <Link
      href={SETTINGS_HREF}
      aria-current={pathname === SETTINGS_HREF ? "page" : undefined}
      onClick={() => setMenuOpen(false)}
      className={`focus-ring group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
        pathname === SETTINGS_HREF ? "bg-surface-sunken" : "hover:bg-surface-sunken"
      }`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-sunken text-[13px] font-medium text-text"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
      >
        {getInitials(name)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] text-text">{name}</div>
        <div className="truncate text-[12px] text-text-muted">Account &amp; Settings</div>
      </div>
      <Settings
        size={15}
        strokeWidth={1.75}
        className={`shrink-0 transition-colors ${
          pathname === SETTINGS_HREF ? "text-text" : "text-text-faint group-hover:text-text-muted"
        }`}
      />
    </Link>
  );

  const helpLink = (
    <button
      type="button"
      aria-keyshortcuts="?"
      onClick={() => {
        setMenuOpen(false);
        setHelpOpen(true);
      }}
      className="focus-ring flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13.5px] font-medium text-text-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-sunken hover:text-text"
    >
      <CircleHelp size={16} strokeWidth={1.75} />
      <span className="flex-1">Help &amp; About</span>
      <kbd className="rounded-sm border border-border bg-surface-sunken px-1.5 py-0.5 text-[12px] leading-4 text-text-faint">
        ?
      </kbd>
    </button>
  );

  return (
    <>
      {/*
       * The mobile bar is fixed rather than sticky: as a grid child its row is
       * only as tall as itself, which would leave a sticky element no room to
       * travel. The spacer underneath takes that row, so the page begins below
       * the bar instead of behind it.
       */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <Link href="/dashboard" className="focus-ring flex items-center gap-2.5 rounded">
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open Navigation"
          aria-expanded={menuOpen}
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors duration-[var(--duration-fast)] hover:bg-surface-sunken active:scale-[0.97]"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </header>
      <div className="h-14 lg:hidden" aria-hidden />

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              aria-label="Close Navigation"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 h-full w-full bg-black/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              drag={prefersReducedMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.15 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 80 || info.velocity.x > 400) setMenuOpen(false);
              }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 400, damping: 40 }
              }
              className="absolute inset-y-0 right-0 flex w-[17rem] max-w-[85vw] flex-col justify-between border-l border-border bg-surface px-5 py-5"
            >
              <div className="min-h-0 overflow-y-auto">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <Wordmark />
                  </span>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close Navigation"
                    className="focus-ring flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors duration-[var(--duration-fast)] hover:bg-surface-sunken active:scale-[0.97]"
                  >
                    <X size={18} strokeWidth={1.75} />
                  </button>
                </div>
                {navLinks}
              </div>
              <div className="shrink-0 border-t border-border pt-3">
                {helpLink}
                <div className="mt-2 border-t border-border pt-2">{accountCard}</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/*
       * The rail stretches the full page height so the panel never stops
       * mid-page; the content inside is what is pinned to the viewport and
       * never scrolls, so nav and the account card stay reachable however long
       * a page gets.
       */}
      <aside className="hidden border-r border-border bg-surface lg:block">
        <div className="sticky top-0 flex h-screen flex-col justify-between overflow-hidden px-5 py-6">
          <div className="min-h-0">
            <Link href="/dashboard" className="mb-9 flex items-center gap-2.5 px-1">
              <Wordmark />
            </Link>
            {navLinks}
          </div>
          <div className="shrink-0 border-t border-border pt-3">
            {helpLink}
            <div className="mt-2 border-t border-border pt-2">{accountCard}</div>
          </div>
        </div>
      </aside>
      <HelpAboutDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
