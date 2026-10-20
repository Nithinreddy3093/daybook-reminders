# Faster start-up, logo sound, snappier mobile

## Why it feels slow after the logo
- Every time you open the app or switch pages, it calls the login server to check who you are. On mobile data that adds a noticeable wait before anything shows.
- Home waits for all tasks and all memories, including photo links, before it shows anything.
- The logo animation ends, but the page behind it is still loading, so you see a blank or loading gap.

## Fixes
1. **Instant sign-in check:** read the saved login on the phone instead of asking the server on every page. The server still checks every data request, so security stays the same.
2. **Show Home right away:** load tasks first and show the page. Memories, friends, streak and the daily briefing fill in a moment later with light placeholders.
3. **Logo hands off smoothly:** the logo stays only until the first screen is ready, up to about 1.2 seconds, then fades into it. No blank gap.
4. **Preload pages:** the next tab loads when you start pressing it, so switching tabs feels instant.

## Logo sound on all devices
- Phones (especially iPhone) and most browsers block sound until you touch the screen. No website can get around this.
- What we'll do: play the chime instantly where the device allows it. Otherwise, play it on your first tap while the logo is showing.
- Use a short sound file that is ready in advance so it starts with no delay. The existing sound on/off setting in Profile still works.

## Mobile speed
- Turn off heavy blur and shadow effects and the staggered page animations on phones.
- Make taps respond immediately everywhere, with no zoom delay.
- Load images only when they come into view, at smaller sizes.

## Technical details
- `_authenticated/route.tsx` beforeLoad: `getSession()` (local) instead of `getUser()`; server fns still use `requireSupabaseAuth`.
- `home.tsx` loader: `ensureQueryData(tasksQuery)` only; memories via non-blocking `useQuery` with skeleton.
- `__root.tsx` splash: remove when `window.__keepReady` is set by AppShell mount (max ~1.2s), else timeout.
- Sound: add `public/sounds/intro.mp3` (short synthesized chime), preload as `<audio>`; try `play()` on load, fall back to the first `pointerdown`/`keydown` while the splash is showing. Respect `keep-sound`.
- `styles.css`: on `(max-width: 767px)`, disable backdrop-blur and reveal stagger, and add `touch-action: manipulation` globally.
- Router: `defaultPreload: "intent"` with `defaultPreloadDelay: 0`.
