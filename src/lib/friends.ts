import { supabase } from "@/integrations/supabase/client";
import type { PublicProfile } from "@/lib/social";

export type Follower = PublicProfile & { followed_at: string; follows_back: boolean };

/** People who follow me, newest first. */
export async function recentFollowers(): Promise<Follower[]> {
  const { data, error } = await supabase.rpc("recent_followers");
  if (error) throw error;
  return (data ?? []) as Follower[];
}

export const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
export const normalizeUsername = (s: string) => s.trim().toLowerCase().replace(/^@/, "");

export async function usernameAvailable(name: string) {
  const { data, error } = await supabase.rpc("username_available", { _name: name });
  if (error) throw error;
  return !!data;
}

// Legacy request helpers (kept for older screens).
export async function incomingRequests(): Promise<PublicProfile[]> {
  const { data, error } = await supabase.rpc("incoming_friend_requests");
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}
export async function respondRequest(sender: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_friend_request", { _sender: sender, _accept: accept });
  if (error) throw error;
}
