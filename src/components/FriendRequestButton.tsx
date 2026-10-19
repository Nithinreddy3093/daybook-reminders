import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { cancelRequest, sendRequest, sentRequestIds } from "@/lib/friends";

export function FriendRequestButton({ id }: { id: string }) {
  const { data: ids = [] } = useQuery({ queryKey: ["sent-requests"], queryFn: sentRequestIds });
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const sent = ids.includes(id);
  const click = async () => {
    setBusy(true);
    try {
      if (sent) await cancelRequest(id); else { await sendRequest(id); toast("Friend request sent"); }
      qc.invalidateQueries({ queryKey: ["sent-requests"] });
    } catch { toast.error("Could not update"); }
    finally { setBusy(false); }
  };
  return (
    <button disabled={busy} onClick={click} className="rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-50">
      {sent ? "Requested" : "Add friend"}
    </button>
  );
}
