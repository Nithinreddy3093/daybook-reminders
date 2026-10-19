import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPush } = await import("@/lib/push-send");
    const { data: subs } = await context.supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", context.userId);
    let sent = 0;
    for (const s of subs ?? []) {
      const r = await sendPush(s, { title: "Keep", body: "Push reminders are working ✓", url: "/profile", tag: "test" });
      if (r === "gone") await context.supabase.from("push_subscriptions").delete().eq("id", s.id);
      if (r === "ok") sent++;
    }
    return { sent };
  });
