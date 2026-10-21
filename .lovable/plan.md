# Fix Keep not opening on phones

I found two errors in the app's error logs that can stop it from starting, especially on slower phones. I haven't confirmed these on your phone, so the last step is a check on a phone-sized screen.

## 1. Opening animation conflicts with the page loading
The logo screen removes itself while the app is still starting up. The app then finds part of the page missing and can stop with a blank screen.
- The logo screen will be built and removed separately from the rest of the page, so it can't interfere when the app starts.
- The look, timing and sound stay the same.

## 2. Notification bell crashes on quick reloads
When the app starts and restarts fast, which happens often on phones, the follower-notification listener gets set up twice and throws an error.
- Set it up only once, and shut it down cleanly when it's no longer needed. Make the same fix for the message-count listener.

## 3. Check
- Load the app on a phone-sized screen, signed in, and confirm Home opens with no errors after the logo.

## Technical details
- `__root.tsx`: remove the `#keep-splash` JSX; have the inline script `createElement` the splash and append it to `document.body` (outside the React root), keeping the existing `__keepSplashReady` hook. This fixes the `throwOnHydrationMismatch` error.
- `ActivityBell.tsx` and `AppShell` `InboxLink`: add a `cancelled` flag so that if cleanup runs before `getUser()` resolves, the channel is never created. Use a unique channel suffix so a stale channel never collides. This fixes "cannot add postgres_changes callbacks after subscribe()".
