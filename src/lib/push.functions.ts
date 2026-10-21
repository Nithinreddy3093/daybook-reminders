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

/** Sends the push for a just-sent message right away. Only the sender can trigger it, and only once per message. */
export const notifyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) => {
    if (!d || typeof d.messageId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.messageId)) throw new Error("bad id");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase.from("messages").select("id").eq("id", data.messageId).eq("sender_id", context.userId).maybeSingle();
    if (!own) return { sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPush } = await import("@/lib/push-send");
    const { data: claimed } = await supabaseAdmin.from("messages").update({ pushed_at: new Date().toISOString() })
      .eq("id", data.messageId).is("pushed_at", null).is("read_at", null).select("sender_id, recipient_id, content");
    const m = claimed?.[0];
    if (!m) return { sent: 0 };
    const { data: p } = await supabaseAdmin.from("profiles").select("display_name, username").eq("id", m.sender_id).maybeSingle();
    const name = p?.display_name || p?.username || "New message";
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", m.recipient_id);
    let sent = 0;
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        const r = await sendPush(s, { title: `💬 ${name}`, body: String(m.content).slice(0, 120), url: `/chat/${m.sender_id}`, tag: `chat-${m.sender_id}`, sound: "received" });
        if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        if (r === "ok") sent++;
      } catch { /* cron fallback won't retry, but keep going */ }
    }));
    return { sent };
  });
