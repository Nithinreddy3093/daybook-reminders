# Message alerts, centered photo viewer, hidden scrollbars

## 1. Notifications when someone messages me
- While Keep is open, but not on that person's chat: show a toast with the sender's name and a short preview (tap to open the chat), play the message chime, and show a phone/browser notification if notifications are allowed.
- When Keep is closed, send a push notification to the recipient: "Name: message preview". Tapping it opens that chat.
- No alert when you're already looking at that chat.

## 2. Photo viewer centered on screen
- Show tapped photos (yours or theirs) in a full-screen viewer layered over the chat, outside the scrolling message list, so the photo sits exactly in the middle of the screen.
- Dark backdrop, close button, tap outside or press back to close. Page scroll is locked so the chat stays where it was.
- Pinch to zoom stays available. Videos open the same way.

## 3. Hide side-scroll lines on phones
- Hide the scrollbar line under the "Friends you follow" row and the Memories tag filters. Side swiping still works.

## Technical details
- Chat image overlay: render it with `createPortal` to `document.body`, `fixed inset-0 z-[100] grid place-items-center`, apply `useScrollLock`, use `object-contain max-h-[90dvh] max-w-[92vw]`, close on Escape, and add a close button.
- Add `no-scrollbar` to `FriendTray.tsx` and the `memories.tsx` filter row.
- In the `AppShell` `InboxLink` realtime INSERT handler, when the user is not on `/chat/<sender>`, fetch the sender's profile, show a sonner toast with an action, and send a `Notification` when permission is granted.
- Push: add an AFTER INSERT trigger on `messages` that calls the server via `pg_net`, or a new `/api/public/jobs/send-message-push` route checked with a shared secret. The route loads the recipient's `push_subscriptions` and calls `sendPush` with `url: /chat/<sender>`. Remove expired subscriptions.
