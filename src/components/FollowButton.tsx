import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getFollowingIds, setFollow } from "@/lib/social";

export const followingIdsQuery = { queryKey: ["following-ids"], queryFn: getFollowingIds };

export function FollowButton({ id }: { id: string }) {
  const { data: ids = [] } = useQuery(followingIdsQuery);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const on = ids.includes(id);
  const click = async () => {
    setBusy(true);
    try {
      await setFollow(id, !on);
      qc.invalidateQueries({ queryKey: ["following-ids"] });
      qc.invalidateQueries({ queryKey: ["following"] });
      qc.invalidateQueries({ queryKey: ["public-profile", id] });
    } catch { toast.error("Could not update"); }
    finally { setBusy(false); }
  };
  return (
    <button disabled={busy} onClick={click}
      className={on ? "rounded-full border px-4 py-1.5 text-sm font-medium" : "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"}>
      {on ? "Following" : "Follow"}
    </button>
  );
}
