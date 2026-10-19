import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getFollowList } from "@/lib/social";
import { ProfileRow } from "@/components/ProfileCard";
import { FollowButton } from "@/components/FollowButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/follows/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: s["tab"] === "following" ? ("following" as const) : ("followers" as const) }),
  head: () => ({
    meta: [
      { title: "Followers — Keep" },
      { name: "description", content: "Followers and following on Keep." },
      { property: "og:title", content: "Followers — Keep" },
      { property: "og:description", content: "Followers and following on Keep." },
    ],
  }),
  component: FollowsPage,
});

function FollowsPage() {
  const { id } = Route.useParams();
  const { tab: initial } = Route.useSearch();
  const [tab, setTab] = useState(initial);
  const me = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "" });
  const list = useQuery({ queryKey: ["follow-list", id, tab], queryFn: () => getFollowList(id, tab) });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => history.back()} aria-label="Back" className="rounded-full p-1.5 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-xl font-bold">Connections</h1>
      </div>
      <div className="grid grid-cols-2 border-b text-sm font-semibold">
        {(["followers", "following"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 capitalize ${tab === t ? "border-b-2 border-foreground" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      {list.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : list.data?.length ? <div className="divide-y">{list.data.map((p) => (
          <ProfileRow key={p.id} p={p} action={p.id === me.data ? <Link to="/profile" className="text-sm text-muted-foreground">You</Link> : <FollowButton id={p.id} />} />
        ))}</div>
        : <p className="text-sm text-muted-foreground">No one here yet.</p>}
    </div>
  );
}
