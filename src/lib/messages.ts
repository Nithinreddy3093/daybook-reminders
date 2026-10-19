import { supabase } from "@/integrations/supabase/client";
import type { PublicProfile } from "@/lib/social";

export type Message = { id: string; sender_id: string; recipient_id: string; content: string; read_at: string | null; created_at: string; kind?: string; plan?: { title: string; due_at?: string | null; remind_at?: string | null; notes?: string | null } | null; plan_status?: string | null; attachment?: Attachment | null };
export type Attachment = { path: string; name: string; type: string; size: number };

async function me() { const { data } = await supabase.auth.getUser(); return data.user!.id; }

export async function getInbox() {
  const uid = await me();
  const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const latest = new Map<string, { last: Message; unread: number; pendingPlans: number }>();
  for (const m of (data ?? []) as Message[]) {
    const other = m.sender_id === uid ? m.recipient_id : m.sender_id;
    const e = latest.get(other) ?? { last: m, unread: 0, pendingPlans: 0 };
    if (m.recipient_id === uid && m.kind === "plan" && m.plan_status === "pending") e.pendingPlans++;
    if (m.recipient_id === uid && !m.read_at) e.unread++;
    latest.set(other, e);
  }
  const ids = [...latest.keys()];
  const { data: ps } = ids.length
    ? await supabase.from("profiles").select("id, display_name, username, bio, streak, last_active").in("id", ids)
    : { data: [] };
  const byId = new Map(((ps ?? []) as PublicProfile[]).map((p) => [p.id, p]));
  return { uid, threads: ids.map((id) => ({ id, profile: byId.get(id) ?? null, ...latest.get(id)! })) };
}

export async function unreadCount() {
  const uid = await me();
  const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", uid).is("read_at", null);
  return count ?? 0;
}

export async function getThread(other: string) {
  const uid = await me();
  const { data, error } = await supabase.from("messages").select("*")
    .or(`and(sender_id.eq.${uid},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${uid})`)
    .order("created_at", { ascending: true }).limit(300);
  if (error) throw error;
  return { uid, messages: (data ?? []) as Message[] };
}

export async function sendMessage(to: string, content: string) {
  const text = content.trim().slice(0, 2000);
  if (!text) return;
  const { error } = await supabase.from("messages").insert({ sender_id: await me(), recipient_id: to, content: text });
  if (error) throw error;
}

export async function markRead(from: string) {
  const uid = await me();
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("sender_id", from).eq("recipient_id", uid).is("read_at", null);
}

export async function sendPlan(to: string, plan: { title: string; due_at: string | null; remind_at: string | null; notes?: string | null }) {
  const title = plan.title.trim().slice(0, 200);
  if (!title) return;
  const { error } = await supabase.from("messages").insert({ sender_id: await me(), recipient_id: to, content: `📅 ${title}`, kind: "plan", plan });
  if (error) throw error;
}

export async function respondPlan(id: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_plan", { _msg: id, _accept: accept });
  if (error) throw error;
}

export async function sendFile(to: string, file: File, caption = "") {
  if (file.size > 50 * 1024 * 1024) throw new Error("Max 50 MB");
  const uid = await me();
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${uid}/${to}/${crypto.randomUUID()}-${safe}`;
  const up = await supabase.storage.from("chat-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (up.error) throw up.error;
  const icon = file.type.startsWith("image/") ? "📷 Photo" : file.type.startsWith("video/") ? "🎬 Video" : file.type.startsWith("audio/") ? "🎤 Voice note" : `📎 ${file.name}`;
  const attachment: Attachment = { path, name: file.name, type: file.type, size: file.size };
  const { error } = await supabase.from("messages").insert({ sender_id: uid, recipient_id: to, content: (caption.trim() || icon).slice(0, 2000), kind: "file", attachment });
  if (error) throw error;
}

const urlCache = new Map<string, { url: string; exp: number }>();
export async function fileUrl(path: string) {
  const c = urlCache.get(path);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await supabase.storage.from("chat-files").createSignedUrl(path, 3600);
  if (error) throw error;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
