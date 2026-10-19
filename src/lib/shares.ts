import { supabase } from "@/integrations/supabase/client";

async function me() { const { data } = await supabase.auth.getUser(); return data.user!.id; }

export type Share = { owner_id: string; viewer_id: string; status: "pending" | "accepted"; created_at: string };

/** My relationship with another person, in both directions. */
export async function shareState(other: string) {
  const uid = await me();
  const { data } = await supabase.from("task_shares").select("*")
    .or(`and(owner_id.eq.${other},viewer_id.eq.${uid}),and(owner_id.eq.${uid},viewer_id.eq.${other})`);
  const rows = (data ?? []) as Share[];
  return {
    uid,
    theirs: rows.find((r) => r.owner_id === other) ?? null, // my access to their tasks
    mine: rows.find((r) => r.owner_id === uid) ?? null,     // their access to my tasks
  };
}

export async function requestAccess(owner: string) {
  const { error } = await supabase.from("task_shares").insert({ owner_id: owner, viewer_id: await me(), status: "pending" });
  if (error) throw error;
}
export async function approve(viewer: string) {
  const uid = await me();
  const { error } = await supabase.from("task_shares").upsert({ owner_id: uid, viewer_id: viewer, status: "accepted" });
  if (error) throw error;
}
export async function removeShare(owner: string, viewer: string) {
  const { error } = await supabase.from("task_shares").delete().eq("owner_id", owner).eq("viewer_id", viewer);
  if (error) throw error;
}
export async function myShares() {
  const uid = await me();
  const { data } = await supabase.from("task_shares").select("*").eq("owner_id", uid).order("created_at", { ascending: false });
  const rows = (data ?? []) as Share[];
  const ids = rows.map((r) => r.viewer_id);
  const { data: ps } = ids.length ? await supabase.from("profiles").select("id, display_name, username, bio, streak, last_active").in("id", ids) : { data: [] };
  const byId = new Map((ps ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: byId.get(r.viewer_id) ?? null }));
}
export async function sharedTasks(owner: string) {
  const { data } = await supabase.from("tasks").select("id, title, due_at, done, priority, category")
    .eq("user_id", owner).order("done").order("due_at", { ascending: true, nullsFirst: false }).limit(50);
  return data ?? [];
}
