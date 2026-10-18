import { supabase } from "@/integrations/supabase/client";

export type PublicProfile = { id: string; display_name: string | null; username: string | null; bio: string | null; streak: number; last_active: string | null };
const COLS = "id, display_name, username, bio, streak, last_active";

/** Streak only counts if active today or yesterday (UTC). */
export function liveStreak(p: Pick<PublicProfile, "streak" | "last_active">, now = new Date()) {
  if (!p.last_active) return 0;
  const today = now.toISOString().slice(0, 10);
  const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  return p.last_active === today || p.last_active === y ? p.streak : 0;
}
export const activeToday = (p: Pick<PublicProfile, "last_active">, now = new Date()) => p.last_active === now.toISOString().slice(0, 10);

async function me() { const { data } = await supabase.auth.getUser(); return data.user!.id; }

export async function searchProfiles(q: string): Promise<PublicProfile[]> {
  const uid = await me();
  const term = q.trim().replace(/[%,()]/g, "");
  let query = supabase.from("profiles").select(COLS).neq("id", uid).limit(20);
  if (term) query = query.or(`display_name.ilike.%${term}%,username.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

export async function getFollowingIds(): Promise<string[]> {
  const uid = await me();
  const { data } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
  return (data ?? []).map((r) => r.following_id);
}

export async function getFollowing(): Promise<PublicProfile[]> {
  const ids = await getFollowingIds();
  if (!ids.length) return [];
  const { data } = await supabase.from("profiles").select(COLS).in("id", ids);
  return ((data ?? []) as PublicProfile[]).sort((a, b) => liveStreak(b) - liveStreak(a));
}

export async function getProfile(id: string) {
  const [{ data: p }, { count: followers }, { count: following }] = await Promise.all([
    supabase.from("profiles").select(COLS).eq("id", id).maybeSingle(),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
  ]);
  return { profile: p as PublicProfile | null, followers: followers ?? 0, following: following ?? 0 };
}

export async function setFollow(id: string, follow: boolean) {
  const uid = await me();
  const res = follow
    ? await supabase.from("follows").insert({ follower_id: uid, following_id: id })
    : await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", id);
  if (res.error) throw res.error;
}

export const initials = (p: { display_name?: string | null; username?: string | null }) =>
  (p.display_name || p.username || "?").slice(0, 2).toUpperCase();
