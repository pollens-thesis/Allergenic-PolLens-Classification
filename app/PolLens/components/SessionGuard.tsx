"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSnapshot, updateSettings, useSettings } from "@/lib/settings";
import { apiFetch } from "@/lib/api";
import { isSignedIn } from "@/lib/session";

const noopSubscribe = () => () => {};

/**
 * Keeps signed-out visitors off the console's pages.
 *
 * Client-side on purpose: the session lives in sessionStorage (lib/settings.ts),
 * which Next's server-side proxy can't read. The server render — and the first
 * client render, before hydration — can't know who is signed in either, so a
 * neutral placeholder is shown until then: protected content never flashes for
 * a signed-out visitor, and a signed-in one is never bounced by mistake.
 *
 * Also reacts to a sign-out or expiry in this tab, via useSettings()'s
 * subscription. Sessions are tab-scoped and are not shared across tabs.
 */
export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const settings = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = hydrated && isSignedIn(settings);

  // Refresh the stored profile once per account when the console opens. Older
  // sessions can still contain names garbled before JWT payloads used UTF-8.
  useEffect(() => {
    if (!allowed || !settings.email) return;
    const email = settings.email;
    let cancelled = false;
    apiFetch("/api/v1/auth/me/")
      .then((res) => (res.ok ? res.json() : null))
      .then((me: { email?: string; fullName?: string; role?: string } | null) => {
        if (cancelled || typeof me?.email !== "string" || typeof me.fullName !== "string") return;
        const current = getSnapshot();
        // A response for an old account must not update a newer session.
        if (current.email !== email || me.email.toLowerCase() !== email.toLowerCase()) return;
        const name = me.fullName.trim();
        const role = me.role === "admin" || me.role === "verifier" ? me.role : "user";
        if (current.name !== name || current.role !== role) updateSettings({ name, role });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowed, settings.email]);

  useEffect(() => {
    if (!hydrated || allowed) return;
    const next = pathname + window.location.search;
    router.replace(`/?next=${encodeURIComponent(next)}`);
  }, [hydrated, allowed, pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center gap-2 bg-bg text-[13px] text-text-muted">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        {hydrated ? "Redirecting to sign in…" : "Checking session…"}
      </div>
    );
  }

  return <>{children}</>;
}
