// Tiny haptic tap on phones that support it (Android). Silently ignored elsewhere.
export function tap(ms: number | number[] = 10) {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* noop */ }
}
