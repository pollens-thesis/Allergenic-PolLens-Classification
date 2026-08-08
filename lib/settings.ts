// ---------------------------------------------------------------------------
// USER SETTINGS
//
// Preferences are small and read on almost every screen, so they live in
// localStorage rather than IndexedDB (which holds the reports and their images).
//
// Reading is done through `useSyncExternalStore`, the React API built for
// exactly this: an external mutable source that must not desync during
// hydration. The server snapshot is always DEFAULTS, so the server-rendered
// HTML is stable, and React swaps in the stored values after hydration without
// a mismatch warning or a setState-inside-an-effect.
//
// TODO(backend): when accounts are real, `load`/`save` become GET/PATCH on the
// profile endpoint and localStorage becomes an offline cache. Nothing that
// calls useSettings() has to change.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from "react";
import type { WeatherCondition } from "@/lib/data";

const STORAGE_KEY = "pollens.settings.v1";
/** Fired on the window so other components in this tab re-read immediately. */
const CHANGE_EVENT = "pollens:settings-changed";

export type Settings = {
  // Profile
  displayName: string;
  email: string;
  institution: string;
  role: string;

  // Defaults applied when a new batch is started on the Analyze screen
  defaultLocation: string;
  defaultWeatherCondition: WeatherCondition;
  autoStampCollectionTime: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  displayName: "Researcher",
  email: "",
  institution: "",
  role: "Researcher",
  defaultLocation: "",
  defaultWeatherCondition: "Sunny",
  autoStampCollectionTime: true,
};

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

export function resetSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** "Maria Reyes" → "MR"; falls back to the first two characters. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
