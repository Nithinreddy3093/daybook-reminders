import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { incomingRequests, respondRequest } from "@/lib/friends";
import { ProfileRow } from "@/components/ProfileCard";
import { playSound } from "@/lib/sounds";

/** Instagram-style activity: badge + sheet with friend requests, live alerts. */
export function ActivityBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: requests = [] } = useQuery({ queryKey: ["friend-requests"], queryFn: incomingRequests, refetchInterval: 60000 });

  useEffect(() => {
    let uid: string | undefined;
    let ch: ReturnType<typeof supabase.channel> | undefined;
    supabase.auth.getUser().then(({ data }) => {
      uid = data.user?.id;
      if (!uid) return;
      const refresh = () => { for (const k of ["friend-requests", "incoming-ids", "following-ids", "following", "sent-requests", "profile"]) qc.invalidateQueries({ queryKey: [k] }); };
      ch = supabase.channel("activity-" + uid)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_requests", filter: `receiver_id=eq.${uid}` }, () => {
          refresh(); playSound("received"); toast("New friend request", { action: { label: "View", onClick: () => setOpen(true) } });
          if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification("Keep", { body: "You have a new friend request", icon: "/icon-512.png" });
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "friend_requests" }, refresh)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows", filter: `following_id=eq.${uid}` }, () => { refresh(); })
        .subscribe();
    });
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [qc]);

  const answer = async (id: string, accept: boolean) => {
    qc.setQueryData(["friend-requests"], requests.filter((r) => r.id !== id));
    try {
      await respondRequest(id, accept);
      toast(accept ? "You're now friends" : "Request removed");
      for (const k of ["following-ids", "following", "incoming-ids", "profile"]) qc.invalidateQueries({ queryKey: [k] });
    } catch { toast.error("Something went wrong"); qc.invalidateQueries({ queryKey: ["friend-requests"] }); }
  };

  const n = requests.length;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Activity" className="relative rounded-full p-2 hover:bg-muted">
        <Bell className="h-5 w-5" />
        {n > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] font-bold text-primary-foreground">{n > 9 ? "9+" : n}</span>}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" onClick={() => setOpen(false)}>
          <div className="keep-bubble-in flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-background" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              <p className="font-display font-semibold">Activity</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-2 text-sm font-semibold">Friend requests</p>
              {!n && <p className="py-6 text-center text-sm text-muted-foreground">No new requests.</p>}
              {requests.map((r) => (
                <ProfileRow key={r.id} p={r} action={
                  <div className="flex gap-1">
                    <button onClick={() => answer(r.id, true)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Accept</button>
                    <button onClick={() => answer(r.id, false)} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Decline</button>
                  </div>
                } />
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
