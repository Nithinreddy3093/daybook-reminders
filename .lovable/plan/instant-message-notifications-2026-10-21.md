# Instant message notifications

Right now, a phone notification for a new message waits for a check that runs once a minute, so it can show up to a minute late. Here is how that changes:

- As soon as a message is sent, the recipient's phone gets the notification right away (usually within 1–2 seconds), whether Keep is open, in the background, or closed.
- This works for every kind of message: text, photo, video, file, voice note, plan or checklist. The notification shows the sender's name and a short preview, and tapping it opens that chat.
- You won't get a duplicate. If the instant send fails, the once-a-minute check still sends it as a backup.
- If you're already looking at that chat, you get no alert. If Keep is open on a different screen, you get the in-app pop-up and chime instead of a second phone notification.

Note: the phone still needs internet. Notifications must be turned on in Profile from the home-screen app (on iPhone this needs iOS 16.4 or later). Sound and vibration are controlled by the phone.

## Technical details
- New authenticated server function `notifyMessage({ messageId })` in `src/lib/push.functions.ts`. It verifies that the caller is the sender (`context.supabase` read). It claims the message atomically through admin (`update pushed_at where id and pushed_at is null returning`) and only sends if it won the claim. It loads the recipient's subscriptions and calls `sendPush` with urgency high, `tag chat-<sender>`, and `url /chat/<sender>`. Expired subscriptions are deleted.
- In `src/lib/messages.ts`, every insert (`sendMessage`, `sendFile`, `sendPlan`, `sendChecklist`, plus the inserts in the chat optimistic path) uses `.select("id")` and fires `notifyMessage` as fire-and-forget.
- `push-sw.js`: if a visible client is already on `/chat/<sender>`, skip `showNotification`. If a visible client is on another screen, post a message and let the in-app toast handle it, to avoid a double alert. Otherwise show it with `renotify`.
- The cron fallback in `send-reminders` stays as is (it only picks rows with `pushed_at` null).
