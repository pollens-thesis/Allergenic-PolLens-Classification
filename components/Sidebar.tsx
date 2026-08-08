"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  ScanLine,
  History,
  Map,
  Leaf,
  Settings,
} from "lucide-react";
import { accountName, getInitials } from "@/lib/account";
import { useSettings } from "@/lib/settings";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/upload", label: "Analyze specimen", icon: ScanLine },
  { href: "/history", label: "History", icon: History },
  { href: "/map", label: "Pollen map", icon: Map },
  { href: "/dataset", label: "Allergen reference", icon: Leaf },
];

// Settings is deliberately absent from the nav: the account card at the bottom
// is the way in, so the same destination isn't offered twice.
const SETTINGS_HREF = "/settings";

export default function Sidebar() {
  const pathname = usePathname();
  const settings = useSettings();

  // The name is the institution read off the signed-in address, so the second
  // line says where the card goes rather than repeating it.
  const name = accountName(settings.email);

  return (
    // The column itself stretches the full page height so the dark panel never
    // stops mid-page; the content inside is what is pinned to the viewport and
    // never scrolls, so nav and the account card stay reachable however long a
    // page gets.
    <aside className="hidden bg-field lg:block">
      <div className="sticky top-0 flex h-screen flex-col justify-between overflow-hidden px-5 py-6">
        <div className="min-h-0">
          <Link
            href="/dashboard"
            className="mb-9 flex items-center gap-2.5 px-1"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-pollen/40">
              <span className="h-2 w-2 rounded-full bg-pollen" />
            </span>
            <span
              className="text-sm tracking-[0.25em] text-parchment/90 uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
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
                  className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition ${
                    active
                      ? "bg-parchment/10 text-parchment"
                      : "text-sage hover:bg-parchment/5 hover:text-parchment/90"
                  }`}
                >
                  <ItemIcon
                    size={16}
                    strokeWidth={1.75}
                    className={active ? "text-pollen" : ""}
                  />
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
                pathname === SETTINGS_HREF
                  ? "text-pollen"
                  : "text-sage/85 group-hover:text-parchment/90"
              }`}
            />
          </Link>
        </div>
      </div>
    </aside>
  );
}
