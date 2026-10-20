import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProfileRow } from "@/components/ProfileCard";
import { FollowButton, followersQuery, FOLLOW_KEYS } from "@/components/FollowButton";
import { playSound } from "@/lib/sounds";

const SEEN_KEY = "keep-activity-seen";
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

/** Instagram-style activity: "X started following you" with live alerts. */
export function ActivityBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const { data: followers = [] } = useQuery({ ...followersQuery, refetchInterval: 60000 });

  useEffect(() => { setSeen(Number(localStorage.getItem(SEEN_KEY) || 0)); }, []);

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | undefined;
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      ch = supabase.channel("activity-" + uid)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows", filter: `following_id=eq.${uid}` }, async (p) => {
          for (const k of FOLLOW_KEYS) qc.invalidateQueries({ queryKey: [k] });
          const fid = (p.new as { follower_id?: string }).follower_id;
          const { data: prof } = fid ? await supabase.rpc("public_profile", { _id: fid }) : { data: null };
          const name = prof?.[0]?.username ? "@" + prof[0].username : prof?.[0]?.display_name || "Someone";
          playSound("received");
          toast(`${name} started following you`, { action: { label: "View", onClick: () => setOpen(true) } });
          if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible")
            new Notification("Keep", { body: `${name} started following you`, icon: "/icon-512.png" });
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "follows" }, () => { for (const k of FOLLOW_KEYS) qc.invalidateQueries({ queryKey: [k] }); })
        .subscribe();
    });
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [qc]);

  const n = followers.filter((f) => new Date(f.followed_at).getTime() > seen).length;
  const show = () => {
    setOpen(true);
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    setTimeout(() => setSeen(now), 400);
  };

  return (
    <>
      <button onClick={show} aria-label="Activity" className="relative rounded-full p-2 hover:bg-muted">
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
              {!followers.length && <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>}
              {followers.map((f) => (
                <div key={f.id} className={new Date(f.followed_at).getTime() > seen ? "rounded-xl bg-muted/50" : ""}>
                  <Link to="/u/$id" params={{ id: f.id }} onClick={() => setOpen(false)} className="block">
                    <ProfileRow p={{ ...f, bio: `started following you · ${ago(f.followed_at)}` }} action={<span onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><FollowButton id={f.id} /></span>} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
