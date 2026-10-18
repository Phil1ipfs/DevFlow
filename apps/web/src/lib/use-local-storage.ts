"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * A string value persisted in localStorage and shared by every component using the same key.
 * Renders `null` on the server and during hydration, then the stored value, so it never causes
 * a hydration mismatch. Changes in other tabs are picked up too.
 */
export function useLocalStorage(key: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(subscribe, () => read(key), () => null);

  const setValue = useCallback(
    (next: string | null) => {
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        // Storage unavailable (private mode): the value simply is not remembered.
      }
      notify(key);
    },
    [key],
  );

  return [value, setValue] as const;
}
