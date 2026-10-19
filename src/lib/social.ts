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
  const { data, error } = await supabase.rpc("search_profiles", { _q: q.trim().slice(0, 50) });
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
  const { data, error } = await supabase.rpc("public_profile", { _id: id });
  if (error) throw error;
  const r = data?.[0];
  if (!r) return { profile: null as PublicProfile | null, followers: 0, following: 0 };
  const { followers, following, ...profile } = r;
  return { profile: profile as PublicProfile, followers: Number(followers), following: Number(following) };
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

export async function getFollowList(id: string, tab: "followers" | "following"): Promise<PublicProfile[]> {
  const { data, error } = await supabase.rpc("follow_list", { _id: id, _tab: tab });
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

/** The signed-in user's own streak, from the same source friends see. */
export async function getMyStreak() {
  const uid = await me();
  const { data } = await supabase.from("profiles").select("streak, last_active").eq("id", uid).maybeSingle();
  return data ? liveStreak(data) : 0;
}
