"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  ScanLine,
  Leaf,
  History,
  Info,
  Settings,
} from "lucide-react";
import { getInitials, useSettings } from "@/lib/settings";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/upload", label: "Analyze specimen", icon: ScanLine },
  { href: "/dataset", label: "Allergen reference", icon: Leaf },
  { href: "/history", label: "History", icon: History },
  { href: "/about", label: "About the study", icon: Info },
];

// Settings is deliberately absent from the nav: the account card at the bottom
// is the way in, so the same destination isn't offered twice.
const SETTINGS_HREF = "/settings";

export default function Sidebar() {
  const pathname = usePathname();
  const settings = useSettings();

  // Institution is the most useful second line, then role — but not when role
  // just repeats the name, which is what the defaults produce. Falling back to
  // the destination keeps the card from reading "Researcher / Researcher" and
  // says what it does, now that Settings has no nav entry of its own.
  const accountSubtitle =
    settings.institution ||
    (settings.role && settings.role !== settings.displayName
      ? settings.role
      : "Account & settings");

  return (
    // Pinned to the viewport and never scrolls: only the main column moves, so
    // navigation and the account card stay reachable however long a page gets.
    <aside className="sticky top-0 hidden h-screen flex-col justify-between overflow-hidden bg-field px-5 py-6 lg:flex">
      <div className="min-h-0">
        <Link href="/dashboard" className="mb-9 flex items-center gap-2.5 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-pollen/40">
            <span className="h-2 w-2 rounded-full bg-pollen" />
          </span>
          <span
            className="text-sm tracking-[0.25em] text-parchment/90 uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            PolLens
          </span>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] transition ${
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
      </div>

      {/* Account and Settings are one entry: the card is the link. */}
      <div className="shrink-0 border-t border-parchment/10 pt-4">
        <Link
          href={SETTINGS_HREF}
          aria-label="Account and settings"
          aria-current={pathname === SETTINGS_HREF ? "page" : undefined}
          className={`focus-ring group flex items-center gap-2.5 rounded-md px-2 py-2 transition ${
            pathname === SETTINGS_HREF
              ? "bg-parchment/10"
              : "hover:bg-parchment/5"
          }`}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-anther/20 text-[12px] text-anther"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {getInitials(settings.displayName)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] text-parchment/90">
              {settings.displayName || "Unnamed"}
            </div>
            <div className="truncate text-[11px] text-sage/70">{accountSubtitle}</div>
          </div>
          <Settings
            size={15}
            strokeWidth={1.75}
            className={`shrink-0 transition ${
              pathname === SETTINGS_HREF
                ? "text-pollen"
                : "text-sage/50 group-hover:text-parchment/80"
            }`}
          />
        </Link>
      </div>
    </aside>
  );
}
