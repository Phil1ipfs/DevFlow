"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-constants";

export type Theme = "light" | "dark" | "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

function notify() {
  applyTheme(readTheme());
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) notify();
  };
  // Follow OS changes while on "system", and keep other open tabs in sync.
  media.addEventListener("change", notify);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", notify);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The user's theme preference. The server always renders "system"; React then re-renders with
 * the stored value after hydration, without a hydration mismatch (that is what the third
 * argument of useSyncExternalStore is for). The actual colors never flash, because the inline
 * ThemeScript has already applied them.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as const);

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this page view.
    }
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }, []);

  return { theme, setTheme };
}
