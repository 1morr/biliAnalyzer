import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

const listeners = new Set<() => void>();
const media = window.matchMedia("(prefers-color-scheme: dark)");

let theme: Theme = readStored();
let resolved: ResolvedTheme = resolve(theme);

function readStored(): Theme {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

function resolve(t: Theme): ResolvedTheme {
  if (t === "system") return media.matches ? "dark" : "light";
  return t;
}

/**
 * Applies the class and notifies every subscriber. Charts read their colors
 * from CSS custom properties, so they must re-render after the class flips —
 * a per-component `useState` cannot do that.
 */
function apply() {
  resolved = resolve(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  for (const l of listeners) l();
}

media.addEventListener("change", () => {
  if (theme === "system") apply();
});

apply();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTheme(next: Theme) {
  theme = next;
  localStorage.setItem(STORAGE_KEY, next);
  apply();
}

export function useTheme() {
  const current = useSyncExternalStore(
    subscribe,
    () => theme,
    () => "system" as Theme,
  );
  const currentResolved = useSyncExternalStore(
    subscribe,
    () => resolved,
    () => "light" as ResolvedTheme,
  );
  return { theme: current, resolvedTheme: currentResolved, setTheme };
}

/** Re-renders the caller whenever the resolved theme changes. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribe,
    () => resolved,
    () => "light" as ResolvedTheme,
  );
}
