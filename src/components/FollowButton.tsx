import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getFollowingIds, setFollow } from "@/lib/social";
import { recentFollowers } from "@/lib/friends";
import { supabase } from "@/integrations/supabase/client";

export const followingIdsQuery = { queryKey: ["following-ids"], queryFn: getFollowingIds };
export const followersQuery = { queryKey: ["recent-followers"], queryFn: recentFollowers };

export const FOLLOW_KEYS = ["following-ids", "following", "recent-followers", "profile", "public-profile", "follow-list"];

/** Instagram-style one-way follow: Follow / Follow back / Following. Unfollowing only removes your own follow. */
export function FollowButton({ id }: { id: string }) {
  const { data: me } = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null, staleTime: Infinity });
  const { data: following = [] } = useQuery(followingIdsQuery);
  const { data: followers = [] } = useQuery(followersQuery);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const isFollowing = following.includes(id);
  const followsMe = followers.some((f) => f.id === id);

  const click = async () => {
    if (isFollowing && !confirm("Unfollow?")) return;
    setBusy(true);
    qc.setQueryData<string[]>(["following-ids"], (old = []) => (isFollowing ? old.filter((x) => x !== id) : [...old, id]));
    try {
      await setFollow(id, !isFollowing);
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") toast.error("Could not update");
    } finally {
      for (const k of FOLLOW_KEYS) qc.invalidateQueries({ queryKey: [k] });
      setBusy(false);
    }
  };
  if (me === undefined || me === id) return null;
  const label = isFollowing ? "Following" : followsMe ? "Follow back" : "Follow";
  return (
    <button disabled={busy} onClick={click}
      className={!isFollowing ? "rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-50" : "rounded-full bg-muted px-4 py-1.5 text-sm font-semibold transition active:scale-95 disabled:opacity-50"}>
      {label}
    </button>
  );
}
