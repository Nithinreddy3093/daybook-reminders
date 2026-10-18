import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Lock } from "lucide-react";
import { getProfile, liveStreak } from "@/lib/social";
import { Avatar } from "@/components/ProfileCard";
import { FollowButton } from "@/components/FollowButton";

export const Route = createFileRoute("/_authenticated/u/$id")({
  head: () => ({
    meta: [
      { title: "Profile — Keep" },
      { name: "description", content: "A friend's Keep profile and streak." },
      { property: "og:title", content: "Profile — Keep" },
      { property: "og:description", content: "A friend's Keep profile and streak." },
    ],
  }),
  component: UserPage,
});

function UserPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["public-profile", id], queryFn: () => getProfile(id) });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const p = data?.profile;
  if (!p) return <div className="space-y-3"><p>This profile isn't set up yet.</p><Link to="/friends" className="text-sm underline">Back to friends</Link></div>;
  const streak = liveStreak(p);
  return (
    <div className="space-y-6">
      <section className="flex items-center gap-5">
        <Avatar p={p} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{p.display_name || p.username || "Keep user"}</h1>
          {p.username && <p className="text-sm text-muted-foreground">@{p.username}</p>}
          <div className="mt-2 flex gap-5 text-sm">
            <span><b>{data.followers}</b> followers</span>
            <span><b>{data.following}</b> following</span>
          </div>
        </div>
      </section>
      {p.bio && <p className="text-sm">{p.bio}</p>}
      <FollowButton id={p.id} />
      <div className="rounded-2xl border p-6 text-center">
        <Flame className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-2 font-display text-4xl font-bold text-gradient-brand">{streak}</p>
        <p className="text-sm text-muted-foreground">day streak</p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        <Lock className="h-6 w-6" />
        <p className="font-semibold text-foreground">This account is private</p>
        <p className="text-sm">Plans and memories are only visible to their owner.</p>
      </div>
    </div>
  );
}
