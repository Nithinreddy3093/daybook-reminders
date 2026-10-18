import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { activeToday, initials, liveStreak, type PublicProfile } from "@/lib/social";

export function Avatar({ p, size = 56 }: { p: PublicProfile; size?: number }) {
  return (
    <div className={activeToday(p) ? "ring-gradient shrink-0" : "shrink-0 rounded-full border p-[3px]"}>
      <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-background font-display font-bold">
        {initials(p)}
      </div>
    </div>
  );
}

export function ProfileRow({ p, action }: { p: PublicProfile; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Link to="/u/$id" params={{ id: p.id }} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar p={p} size={44} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.display_name || p.username || "Keep user"}</p>
          <p className="truncate text-xs text-muted-foreground">{p.username ? `@${p.username}` : p.bio}</p>
        </div>
      </Link>
      <span className="flex items-center gap-1 text-sm font-semibold"><Flame className="h-4 w-4 text-primary" />{liveStreak(p)}</span>
      {action}
    </div>
  );
}
