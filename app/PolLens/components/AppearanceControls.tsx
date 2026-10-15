"use client";

import { Moon, Sun, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Toaster } from "sonner";
import { updateAppearance, useAppearance } from "@/lib/appearance";

export function ThemeToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { theme } = useAppearance();
  const dark = theme === "dark";
  const label = dark ? "Switch to Light Mode" : "Switch to Dark Mode";
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => updateAppearance({ theme: dark ? "light" : "dark" })}
      className={`focus-ring inline-flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text ${compact ? "w-11 justify-center px-0" : ""} ${className}`}
    >
      <Icon size={18} strokeWidth={1.75} className="shrink-0" />
      {!compact && <span className="sidebar-label">{dark ? "Light Mode" : "Dark Mode"}</span>}
    </button>
  );
}

export function SidebarToggle({ labelled = false }: { labelled?: boolean }) {
  const { sidebarCollapsed } = useAppearance();
  const label = sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar";
  const Icon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={!sidebarCollapsed}
      aria-controls="desktop-sidebar"
      title={label}
      onClick={() => updateAppearance({ sidebarCollapsed: !sidebarCollapsed })}
      className={`focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md text-text-muted hover:bg-surface-hover hover:text-text ${labelled ? "px-3 text-[13.5px] font-medium" : "w-11"}`}
    >
      <Icon size={18} strokeWidth={1.75} />
      {labelled && label}
    </button>
  );
}

export function AppearanceToaster() {
  const { theme } = useAppearance();
  return <Toaster position="bottom-right" theme={theme} />;
}
