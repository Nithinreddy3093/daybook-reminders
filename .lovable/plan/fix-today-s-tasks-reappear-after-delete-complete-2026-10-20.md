# Fix: Today's tasks reappear after delete / complete

## What's happening (confirmed)
The Plans list loads every task you are *allowed to read*, not just your own. When a friend has accepted your "show my tasks" request (or you accepted theirs), their tasks also appear in your Plans list. Example from the database: "Morning Trek Together" exists twice — one copy is yours (already done), the other belongs to your friend (not done).

When you tap delete or complete on your friend's copy, the screen hides it right away, but the backend correctly refuses to change someone else's task. The app ignores that refusal, reloads, and the task pops back.

## Fix
1. Plans, Home and the calendar only show **your own** tasks.
2. Your friend's shared tasks stay visible only where they belong (their profile, read-only).
3. Delete and mark-done check the result: if nothing was changed, show "Couldn't update this task" and don't fake success.
4. Completing a repeating task only creates the next copy if marking it done worked.

## Technical details
- `src/lib/data.ts` `tasksQuery`: get current user id and add `.eq("user_id", uid)`.
- `src/lib/tasks.ts` `toggleTask`: use `.select("id")` on update, throw if error or zero rows; insert next occurrence only after success.
- `src/routes/_authenticated/plans.tsx` `remove` and `toggle`: use `.delete().eq("id").select("id")`, restore and toast on error/zero rows; wrap toggle in try/catch.
- No database changes needed; existing access rules are correct.
