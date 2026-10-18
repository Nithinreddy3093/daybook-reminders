import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { getFollowing, searchProfiles } from "@/lib/social";
import { ProfileRow } from "@/components/ProfileCard";
import { FollowButton } from "@/components/FollowButton";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({
    meta: [
      { title: "Friends — Keep" },
      { name: "description", content: "Find friends on Keep, follow them and cheer on their streaks." },
      { property: "og:title", content: "Friends — Keep" },
      { property: "og:description", content: "Find friends on Keep, follow them and cheer on their streaks." },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { const t = setTimeout(() => setTerm(q), 300); return () => clearTimeout(t); }, [q]);
  const results = useQuery({ queryKey: ["search-profiles", term], queryFn: () => searchProfiles(term), enabled: term.trim().length > 0 });
  const following = useQuery({ queryKey: ["following"], queryFn: getFollowing });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Friends</h1>
      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or username"
          className="w-full bg-transparent text-sm outline-none" />
      </div>

      {term.trim() ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Results</h2>
          {results.isLoading ? <p className="text-sm text-muted-foreground">Searching…</p>
            : results.data?.length ? <div className="divide-y">{results.data.map((p) => <ProfileRow key={p.id} p={p} action={<FollowButton id={p.id} />} />)}</div>
            : <p className="text-sm text-muted-foreground">No one found.</p>}
        </section>
      ) : (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Following · {following.data?.length ?? 0}</h2>
          {following.data?.length ? <div className="divide-y">{following.data.map((p) => <ProfileRow key={p.id} p={p} action={<FollowButton id={p.id} />} />)}</div>
            : <p className="text-sm text-muted-foreground">You aren't following anyone yet. Search above to find friends.</p>}
        </section>
      )}
      <p className="text-xs text-muted-foreground">Friends only see your name, username, bio and streak. Your plans and memories stay private.</p>
    </div>
  );
}
