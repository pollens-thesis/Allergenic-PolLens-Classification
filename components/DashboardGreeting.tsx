"use client";

import { displayName } from "@/lib/account";
import { useSettings } from "@/lib/settings";

/** "Welcome Back, {the person's name}" — same identity the sidebar already shows. */
export default function DashboardGreeting() {
  const settings = useSettings();
  const name = displayName(settings);

  return (
    <h1 className="text-3xl text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
      Welcome Back, {name}
    </h1>
  );
}
