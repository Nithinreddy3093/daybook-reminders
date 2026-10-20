# Fix the opening logo animation and sound on phones

## Why it breaks on phones
- The logo fade-out is on a fixed 0.6s timer that starts the moment the page appears. On a phone the logo picture and app are still loading then, so the splash fades out while empty: you see a blank screen, then the app pops in.
- The splash is also force-removed after 1.2s even if the app isn't ready, leaving another blank gap.
- The "show once per visit" memory is kept by home-screen apps on iPhone, so reopening from the home screen often skips the splash entirely.
- Sound: phones block sound until the first touch, so the chime is silent on a normal open.

## Fixes
1. **Logo always visible first:** the logo is built into the page itself (no separate download), so it shows instantly with the pop-in animation.
2. **Splash leaves only when the app is ready:** it stays until the first screen has drawn (minimum ~0.9s so the animation finishes, maximum ~3s), then fades straight into the app. No blank space.
3. **Shows on every fresh open:** plays each time you open Keep from the home screen or a new tab, but not when switching pages inside the app.
4. **Sound:** play the chime the moment the phone allows it. If blocked, show a small "Tap to start" hint on the splash; tapping plays the chime and enters the app. Sound off in Profile still mutes it.

Note: no website can play sound on an iPhone before you touch the screen; the tap fallback is the only reliable way.

## Technical details
- `__root.tsx`: inline the logo as a small data URL in the splash markup; replace sessionStorage gate with a check on `performance.navigation` type / first-load flag in memory (window variable), so cold starts always show it.
- `styles.css`: remove the time-based `keep-splash-out` auto animation; add a `.keep-splash-hide` class that fades it out.
- Splash script sets a start time; `AppShell`/root `useEffect` sets `window.__keepReady` after first paint (double rAF). Hide when ready and elapsed ≥ 900ms, fallback hide at 3s; remove element on transitionend.
- Sound: keep Web Audio chime; if `ctx.state !== "running"` after `resume()`, show the "Tap to start" hint and keep the splash until tap (cap 4s, then hide silently).
