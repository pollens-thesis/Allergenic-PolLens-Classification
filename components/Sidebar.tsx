"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-pollen/40">
        <span className="h-2 w-2 rounded-full bg-pollen" />
      </span>
      <span
        className="text-sm tracking-[0.25em] text-parchment/90 uppercase"
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
            className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition ${
              active
                ? "bg-parchment/10 text-parchment"
                : "text-sage hover:bg-parchment/5 hover:text-parchment/90"
            }`}
          >
            <ItemIcon size={16} strokeWidth={1.75} className={active ? "text-pollen" : ""} />
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
      className={`focus-ring group flex items-center gap-2.5 rounded-md px-2 py-2 transition ${
        pathname === SETTINGS_HREF ? "bg-parchment/10" : "hover:bg-parchment/5"
      }`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-anther/25 text-[13px] font-medium text-parchment"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
      >
        {getInitials(name)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] text-parchment/90">{name}</div>
        <div className="truncate text-[12px] text-sage">Account &amp; settings</div>
      </div>
      <Settings
        size={15}
        strokeWidth={1.75}
        className={`shrink-0 transition ${
          pathname === SETTINGS_HREF ? "text-pollen" : "text-sage/85 group-hover:text-parchment/90"
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
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-parchment/10 bg-field px-4 lg:hidden">
        <Link href="/dashboard" className="focus-ring flex items-center gap-2.5 rounded">
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-md text-parchment/90 transition hover:bg-parchment/10"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </header>
      <div className="h-14 lg:hidden" aria-hidden />

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-field/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 right-0 flex w-[17rem] max-w-[85vw] flex-col justify-between bg-field px-5 py-5 shadow-xl"
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
                  className="focus-ring flex h-10 w-10 items-center justify-center rounded-md text-parchment/90 transition hover:bg-parchment/10"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
              {navLinks}
            </div>
            <div className="shrink-0 border-t border-parchment/10 pt-4">{accountCard}</div>
          </div>
        </div>
      )}

      {/*
       * The rail stretches the full page height so the dark panel never stops
       * mid-page; the content inside is what is pinned to the viewport and
       * never scrolls, so nav and the account card stay reachable however long
       * a page gets.
       */}
      <aside className="hidden bg-field lg:block">
        <div className="sticky top-0 flex h-screen flex-col justify-between overflow-hidden px-5 py-6">
          <div className="min-h-0">
            <Link href="/dashboard" className="mb-9 flex items-center gap-2.5 px-1">
              <Wordmark />
            </Link>
            {navLinks}
          </div>
          <div className="shrink-0 border-t border-parchment/10 pt-4">{accountCard}</div>
        </div>
      </aside>
    </>
  );
}
