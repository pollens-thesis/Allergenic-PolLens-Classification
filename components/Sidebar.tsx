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
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const settings = useSettings();

  return (
    <aside className="hidden flex-col justify-between bg-field px-5 py-6 lg:flex">
      <div>
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

      <div className="border-t border-parchment/10 pt-4">
        <Link
          href="/settings"
          className="focus-ring flex items-center gap-2.5 rounded-md px-1 py-1.5 transition hover:bg-parchment/5"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-anther/20 text-[12px] text-anther"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {getInitials(settings.displayName)}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] text-parchment/90">
              {settings.displayName || "Unnamed"}
            </div>
            <div className="truncate text-[11px] text-sage/70">
              {settings.institution || settings.role}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
