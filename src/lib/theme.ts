export type Theme = "light" | "dark" | "oled";
export const THEMES: Theme[] = ["light", "dark", "oled"];

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  el.classList.remove("dark", "oled");
  if (t !== "light") el.classList.add("dark");
  if (t === "oled") el.classList.add("oled");
  localStorage.setItem("keep-theme", t);
}

export function readTheme(): Theme {
  const t = localStorage.getItem("keep-theme");
  return t === "dark" || t === "oled" ? t : "light";
}
