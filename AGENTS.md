<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- App data (tasks, memories) is read/written from the browser via the Supabase client with per-user RLS; uploads go to the private `uploads` bucket under `<user_id>/`. Why: simple CRUD, RLS enforces ownership.
- AI calls live in `src/lib/ai.functions.ts` behind `requireSupabaseAuth`. Why: keeps prompts and keys server-side.
- Reminders fire in-app (toast + browser Notification) while the app is open. Why: no push service configured yet.
- Closed-app reminders use Web Push: `public/push-sw.js` (push-only worker, no caching), subscriptions in `push_subscriptions`, and a per-minute managed schedule calling `/api/public/jobs/send-reminders`; `tasks.push_sent_for` prevents duplicate sends. Why: works on workerd via WebCrypto library, no third-party push service.
- Direct messages live in `messages` with sender/recipient RLS and realtime; friends never get access to tasks or memories. Why: privacy-first social.
- Streaks shown anywhere come from `profiles.streak` via `liveStreak`. Why: one source so friends and owner see the same number.
