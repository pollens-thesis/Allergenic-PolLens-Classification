"use client";

import { accountName } from "@/lib/account";
import { useSettings } from "@/lib/settings";

/** "Welcome back, {institution or person}" — same identity the sidebar already shows. */
export default function DashboardGreeting() {
  const settings = useSettings();
  const name = accountName(settings.email);

  return (
    <h1 className="text-3xl text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
      Welcome Back, {name}
    </h1>
  );
}
