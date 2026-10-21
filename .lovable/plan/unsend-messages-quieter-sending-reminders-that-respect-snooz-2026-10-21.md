# Unsend messages, quieter sending, reminders that respect snooze

## 1. Delete (unsend) messages like Instagram
- Long-press (phone) or the "..." menu (computer) on your own message, photo, video, file or voice note, then choose **Unsend**. A confirm step stops accidental deletes.
- The message disappears for both of you right away. Its photo or file is deleted from storage too.
- You can only unsend your own messages. On their messages you can choose **Remove for me**, which hides it only on your side.

## 2. Sending sound
- Turn off the sound when you send a message, photo, plan or checklist.
- Keep the chime for messages you receive. Add an on/off switch for message sounds in Profile.

## 3. Reminders stop repeating
- Tapping **Done**, **Snooze** or swiping the reminder away records it, so it won't come back when you reopen Keep.
- Snooze 15m or 1h moves the reminder to that time. Reopening Keep earlier shows nothing; it appears again only at the new time.
- Each reminder shows once for its set time, on every device, including closed-app notifications.

## Technical details
- Migration: DELETE policy on `messages` where `auth.uid() = sender_id`; a `hidden_for uuid[]` column (default empty) plus a `hide_message` RPC for "Remove for me". Add `messages` DELETE to the realtime handling in the chat so the other side removes it live. Delete the `chat-files` object when the sender unsends.
- Chat: remove `playSound("sent")` calls; filter out messages hidden for the current user; optimistic removal with rollback on error.
- Reminders: add a `reminded_for timestamptz` column on `tasks`. `ReminderWatcher` fires only when `remind_at <= now` and `reminded_for` is not equal to `remind_at`, then sets `reminded_for = remind_at` right away (dismissing counts as seen). Snooze updates `remind_at` to the future, so it fires once at the new time. The push job also skips tasks whose reminder was already shown in the app.
