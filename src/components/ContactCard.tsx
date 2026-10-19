import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, User } from "lucide-react";
import { getProfile, liveStreak } from "@/lib/social";
import { Avatar } from "@/components/ProfileCard";
import { FollowButton } from "@/components/FollowButton";

export const PROFILE_LINK = /\/u\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** WhatsApp-style shared contact card for a Keep profile link. */
export function ContactCard({ id, myId }: { id: string; myId: string }) {
  const { data } = useQuery({ queryKey: ["public-profile", id], queryFn: () => getProfile(id), staleTime: 60_000 });
  const p = data?.profile;
  const self = id === myId;
  return (
    <div className="w-64 overflow-hidden rounded-3xl border bg-background text-foreground">
      <Link to="/u/$id" params={{ id }} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
        {p ? <Avatar p={p} size={44} /> : <div className="h-11 w-11 rounded-full bg-muted" />}
        <div className="min-w-0">
          <p className="truncate font-semibold">{p?.display_name || (p?.username ? `@${p.username}` : "Keep profile")}</p>
          <p className="truncate text-xs text-muted-foreground">{p?.username ? `@${p.username} · ` : ""}🔥 {p ? liveStreak(p) : 0} day streak</p>
        </div>
      </Link>
      <div className="grid grid-cols-2 border-t text-xs font-semibold">
        <Link to="/u/$id" params={{ id }} className="flex items-center justify-center gap-1 py-2.5 active:bg-muted"><User className="h-3.5 w-3.5" />View profile</Link>
        {!self && <Link to="/chat/$id" params={{ id }} className="flex items-center justify-center gap-1 border-l py-2.5 active:bg-muted"><MessageCircle className="h-3.5 w-3.5" />Message</Link>}
      </div>
      {!self && <div className="border-t p-2 [&_button]:w-full"><FollowButton id={id} /></div>}
    </div>
  );
}
