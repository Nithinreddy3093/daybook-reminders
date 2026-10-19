import { supabase } from "@/integrations/supabase/client";
import type { PublicProfile } from "@/lib/social";

export async function incomingRequests(): Promise<PublicProfile[]> {
  const { data, error } = await supabase.rpc("incoming_friend_requests");
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

export async function sentRequestIds(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  const { data } = await supabase.from("friend_requests").select("receiver_id").eq("sender_id", u.user!.id);
  return (data ?? []).map((r) => r.receiver_id);
}

export async function sendRequest(id: string) {
  const { error } = await supabase.from("friend_requests").insert({ receiver_id: id });
  if (error && error.code !== "23505") throw error;
}

export async function cancelRequest(id: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("friend_requests").delete().eq("sender_id", u.user!.id).eq("receiver_id", id);
  if (error) throw error;
}

export async function respondRequest(sender: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_friend_request", { _sender: sender, _accept: accept });
  if (error) throw error;
}

export async function incomingIds(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  const { data } = await supabase.from("friend_requests").select("sender_id").eq("receiver_id", u.user!.id);
  return (data ?? []).map((r) => r.sender_id);
}

export async function unfriend(id: string) {
  const { error } = await supabase.rpc("unfriend", { _other: id });
  if (error) throw error;
}
