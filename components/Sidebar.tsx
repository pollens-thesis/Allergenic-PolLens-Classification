"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { accountName, getInitials } from "@/lib/account";
import { useSettings } from "@/lib/settings";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/upload", label: "Analyze specimen", icon: ScanLine },
  { href: "/reports", label: "Report", icon: FileText },
  { href: "/map", label: "Pollen map", icon: Map },
  { href: "/dataset", label: "Allergen reference", icon: Leaf },
];

// Settings is deliberately absent from the nav: the account card at the bottom
// is the way in, so the same destination isn't offered twice.
const SETTINGS_HREF = "/settings";

/** The PolLens mark, shown in the rail and in the mobile bar. */
function Wordmark() {
  return (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/30">
        <span className="h-2 w-2 rounded-full bg-accent" />
      </span>
      <span
        className="text-sm tracking-[0.18em] text-text uppercase"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
      >
        PolLens
      </span>
    </>
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
  const settings = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // The name is the institution read off the signed-in address, so the second
  // line says where the card goes rather than repeating it.
  const name = accountName(settings.email);

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
                ? "bg-accent-muted text-text"
                : "text-text-muted hover:bg-surface-sunken hover:text-text"
            }`}
          >
            <ItemIcon size={16} strokeWidth={1.75} className={active ? "text-accent" : ""} />
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
      aria-label="Account and settings"
      aria-current={pathname === SETTINGS_HREF ? "page" : undefined}
      onClick={() => setMenuOpen(false)}
      className={`focus-ring group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
        pathname === SETTINGS_HREF ? "bg-accent-muted" : "hover:bg-surface-sunken"
      }`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[13px] font-medium text-accent"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
      >
        {getInitials(name)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] text-text">{name}</div>
        <div className="truncate text-[12px] text-text-muted">Account &amp; settings</div>
      </div>
      <Settings
        size={15}
        strokeWidth={1.75}
        className={`shrink-0 transition-colors ${
          pathname === SETTINGS_HREF ? "text-accent" : "text-text-faint group-hover:text-text-muted"
        }`}
      />
    </Link>
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
          aria-label="Open navigation"
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
              aria-label="Close navigation"
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
              className="absolute inset-y-0 right-0 flex w-[17rem] max-w-[85vw] flex-col justify-between border-l border-border bg-surface px-5 py-5 shadow-xl"
            >
              <div className="min-h-0 overflow-y-auto">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <Wordmark />
                  </span>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close navigation"
                    className="focus-ring flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors duration-[var(--duration-fast)] hover:bg-surface-sunken active:scale-[0.97]"
                  >
                    <X size={18} strokeWidth={1.75} />
                  </button>
                </div>
                {navLinks}
              </div>
              <div className="shrink-0 border-t border-border pt-4">{accountCard}</div>
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
          <div className="shrink-0 border-t border-border pt-4">{accountCard}</div>
        </div>
      </aside>
    </>
  );
}
