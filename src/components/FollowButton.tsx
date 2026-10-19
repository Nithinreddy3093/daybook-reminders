import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getFollowingIds } from "@/lib/social";
import { cancelRequest, incomingIds, respondRequest, sendRequest, sentRequestIds, unfriend } from "@/lib/friends";
import { supabase } from "@/integrations/supabase/client";

export const followingIdsQuery = { queryKey: ["following-ids"], queryFn: getFollowingIds };

/** Two-way friend button: Add friend → Requested → Friends (or Accept when they asked you). */
export function FollowButton({ id }: { id: string }) {
  const { data: me } = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null, staleTime: Infinity });
  const { data: friends = [] } = useQuery(followingIdsQuery);
  const { data: sent = [] } = useQuery({ queryKey: ["sent-requests"], queryFn: sentRequestIds });
  const { data: incoming = [] } = useQuery({ queryKey: ["incoming-ids"], queryFn: incomingIds });
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const state = friends.includes(id) ? "friends" : incoming.includes(id) ? "incoming" : sent.includes(id) ? "sent" : "none";

  const click = async () => {
    if (state === "friends" && !confirm("Remove this friend?")) return;
    setBusy(true);
    try {
      if (state === "friends") { await unfriend(id); toast("Friend removed"); }
      else if (state === "incoming") { await respondRequest(id, true); toast("You're now friends"); }
      else if (state === "sent") await cancelRequest(id);
      else { await sendRequest(id); toast("Friend request sent"); }
      for (const k of ["following-ids", "following", "sent-requests", "incoming-ids", "friend-requests", "profile", "public-profile"]) qc.invalidateQueries({ queryKey: [k] });
    } catch { toast.error("Could not update"); }
    finally { setBusy(false); }
  };
  const label = { friends: "Friends", incoming: "Accept", sent: "Requested", none: "Add friend" }[state];
  const solid = state === "none" || state === "incoming";
  if (me === undefined || me === id) return null;
  return (
    <button disabled={busy} onClick={click}
      className={solid ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" : "rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-50"}>
      {label}
    </button>
  );
}
