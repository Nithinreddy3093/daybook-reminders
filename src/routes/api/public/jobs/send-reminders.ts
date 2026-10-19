import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/push-send");

        const now = new Date();
        const since = new Date(now.getTime() - 12 * 3600_000).toISOString();
        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select("id, user_id, title, remind_at, push_sent_for")
          .eq("done", false)
          .lte("remind_at", now.toISOString())
          .gte("remind_at", since)
          .limit(200);
        if (error) return Response.json({ error: "query failed" }, { status: 500 });

        const due = (tasks ?? []).filter((t) => !t.push_sent_for || +new Date(t.push_sent_for) !== +new Date(t.remind_at!));
        let sent = 0;
        for (const t of due) {
          const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", t.user_id);
          for (const s of subs ?? []) {
            try {
              const r = await sendPush(s, { title: "⏰ Reminder", body: t.title, url: "/plans", tag: t.id });
              if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
              if (r === "ok") sent++;
            } catch { /* keep going */ }
          }
          await supabaseAdmin.from("tasks").update({ push_sent_for: t.remind_at }).eq("id", t.id);
        }
        return Response.json({ due: due.length, sent });
      },
    },
  },
});
