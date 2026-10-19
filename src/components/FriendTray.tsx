import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Plus } from "lucide-react";
import { getFollowing, liveStreak } from "@/lib/social";
import { Avatar } from "@/components/ProfileCard";

export function FriendTray() {
  const { data = [] } = useQuery({ queryKey: ["following"], queryFn: getFollowing });
  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
      <Link to="/friends" className="flex w-16 shrink-0 flex-col items-center gap-1 text-xs">
        <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 border-dashed"><Plus className="h-5 w-5" /></div>
        <span className="text-muted-foreground">Find</span>
      </Link>
      {data.map((p) => (
        <Link key={p.id} to="/u/$id" params={{ id: p.id }} className="flex w-16 shrink-0 flex-col items-center gap-1 text-xs">
          <Avatar p={p} size={56} />
          <span className="w-full truncate text-center"><Flame className="mr-0.5 inline h-3 w-3 text-primary" />{liveStreak(p)} {p.display_name || p.username}</span>
        </Link>
      ))}
    </div>
  );
}
