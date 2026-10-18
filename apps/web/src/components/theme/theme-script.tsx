import { THEME_STORAGE_KEY } from "./theme-constants";

// Runs synchronously while the browser parses <head>, before first paint, so the page never
// flashes the wrong theme. Keep in sync with applyTheme() in theme-store.ts.
const script = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
