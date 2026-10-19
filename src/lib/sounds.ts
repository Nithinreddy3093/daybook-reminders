// Tiny Web Audio synth for app sounds. No files, no network, instant playback.
export type SoundName = "reminder" | "received" | "sent";

let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("keep-sound") === "off") return null;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx ??= new C();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(a: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playSound(name: SoundName) {
  const a = audio();
  if (!a) return;
  if (name === "reminder") {
    [880, 1318.5, 880, 1318.5].forEach((f, i) => tone(a, f, i * 0.18, 0.6, 0.14));
  } else if (name === "received") {
    tone(a, 987.8, 0, 0.25, 0.1);
    tone(a, 1318.5, 0.09, 0.35, 0.09);
  } else {
    tone(a, 660, 0, 0.12, 0.07, "triangle");
  }
}

/** Unlock audio on first tap so later sounds (from realtime events) can play. */
export function unlockAudioOnGesture() {
  if (typeof window === "undefined") return;
  const h = () => { audio(); window.removeEventListener("pointerdown", h); };
  window.addEventListener("pointerdown", h, { once: true });
}
