// ---------------------------------------------------------------------------
// SIGNED-IN ACCOUNT
//
// The console stores one thing about you: the address you signed in with.
// Everything else on the profile — the name, the institution, the initials on
// the avatar — is derived from it in lib/account.ts rather than stored, so
// there is no second copy to fall out of step.
//
// It is small and read on almost every screen, so it lives in localStorage
// rather than IndexedDB (which holds the reports and their images).
//
// Reading is done through `useSyncExternalStore`, the React API built for
// exactly this: an external mutable source that must not desync during
// hydration. The server snapshot is always DEFAULTS, so the server-rendered
// HTML is stable, and React swaps in the stored values after hydration without
// a mismatch warning or a setState-inside-an-effect.
//
// Google sign-in is real (see SignInForm.tsx, lib/auth.ts): the address
// comes from the verified ID token rather than a typed-in form, and the
// backend's JWT pair rides alongside it for authenticated requests. Nothing
// that calls useSettings() for the email had to change.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pollens.settings.v1";
/** Fired on the window so other components in this tab re-read immediately. */
const CHANGE_EVENT = "pollens:settings-changed";

export type Settings = {
  /** The address this browser is signed in with. Empty means signed out. */
  email: string;
  /** JWT pair from the backend's Google token exchange (see lib/auth.ts). */
  accessToken?: string;
  refreshToken?: string;
};

export const DEFAULT_SETTINGS: Settings = { email: "" };

// getSnapshot must return a referentially stable value or React re-renders
// forever, so the parsed object is cached against the raw string it came from.
let cachedRaw: string | null = null;
let cachedValue: Settings = DEFAULT_SETTINGS;

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private modes and blocked storage: fall back to defaults rather than throw.
    return null;
  }
}

function getSnapshot(): Settings {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  if (!raw) {
    cachedValue = DEFAULT_SETTINGS;
    return cachedValue;
  }

  try {
    // Spread over the defaults so a settings blob written by an older build is
    // still usable after new fields are added.
      cachedValue = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    cachedValue = DEFAULT_SETTINGS;
  }
  return cachedValue;
}

function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // changes made in another tab
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Merges a patch into the stored settings and notifies every subscriber. */
export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...getSnapshot(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nothing useful to do if storage is unavailable; keep the app running.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Sign out: forget the account this browser was using. */
export function resetSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
