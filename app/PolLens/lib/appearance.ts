"use client";

import { useSyncExternalStore } from "react";

export type Appearance = { theme: "light" | "dark"; sidebarCollapsed: boolean };
const STORAGE_KEY = "pollens.appearance.v1";
const CHANGE_EVENT = "pollens:appearance-changed";
const DEFAULTS: Appearance = { theme: "light", sidebarCollapsed: false };
let cachedRaw: string | null | undefined;
let cachedValue = DEFAULTS;
let volatileValue: Appearance | null = null;

function getSnapshot(): Appearance {
  if (volatileValue) return volatileValue;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedValue;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const value = JSON.parse(raw ?? "null");
    cachedValue = {
      theme: value?.theme === "dark" ? "dark" : "light",
      sidebarCollapsed: value?.sidebarCollapsed === true,
    };
  } catch {
    cachedValue = DEFAULTS;
  }
  return cachedValue;
}

function applyAppearance(value: Appearance) {
  document.documentElement.dataset.theme = value.theme;
  document.documentElement.dataset.sidebar = value.sidebarCollapsed ? "collapsed" : "expanded";
}

function subscribe(onChange: () => void) {
  const sync = () => {
    applyAppearance(getSnapshot());
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    volatileValue = null;
    sync();
  };
  applyAppearance(getSnapshot());
  window.addEventListener(CHANGE_EVENT, sync);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, sync);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppearance() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
}

export function updateAppearance(patch: Partial<Appearance>) {
  const next = { ...getSnapshot(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    volatileValue = null;
  } catch {
    // Even when storage is blocked, controls still work for this page session.
    volatileValue = next;
  }
  applyAppearance(next);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
