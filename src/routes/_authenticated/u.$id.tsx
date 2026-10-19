import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Flame, Lock, MessageCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { getProfile, liveStreak } from "@/lib/social";
import { Avatar } from "@/components/ProfileCard";
import { FollowButton } from "@/components/FollowButton";
import { approve, removeShare, requestAccess, shareState, sharedTasks } from "@/lib/shares";

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
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["public-profile", id], queryFn: () => getProfile(id) });
  const share = useQuery({ queryKey: ["share", id], queryFn: () => shareState(id) });
  const canSee = share.data?.theirs?.status === "accepted";
  const tasks = useQuery({ queryKey: ["shared-tasks", id], queryFn: () => sharedTasks(id), enabled: canSee });
  const refresh = () => qc.invalidateQueries({ queryKey: ["share", id] });
  const act = async (fn: () => Promise<void>, msg: string) => {
    try { await fn(); toast(msg); refresh(); qc.invalidateQueries({ queryKey: ["my-shares"] }); }
    catch { toast.error("Something went wrong"); }
  };

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-6"><div className="h-24 w-24 rounded-full bg-muted" /><div className="h-6 flex-1 rounded bg-muted" /></div>
      <div className="h-10 rounded-xl bg-muted" />
    </div>
  );
  const p = data?.profile;
  if (!p) return <div className="space-y-3"><p>This profile isn't set up yet.</p><Link to="/friends" className="text-sm underline">Back to friends</Link></div>;
  const streak = liveStreak(p);
  const name = p.display_name || p.username || "Keep user";
  const theirs = share.data?.theirs;
  const mine = share.data?.mine;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="flex items-center gap-6">
        <Avatar p={p} size={92} />
        <div className="grid flex-1 grid-cols-3 text-center">
          <Stat n={streak} label="streak" icon />
          <Link to="/follows/$id" params={{ id: p.id }} search={{ tab: "followers" }}><Stat n={data.followers} label="followers" /></Link>
          <Link to="/follows/$id" params={{ id: p.id }} search={{ tab: "following" }}><Stat n={data.following} label="following" /></Link>
        </div>
      </section>

      <div>
        <h1 className="font-display text-lg font-semibold">{name}</h1>
        {p.username && <p className="text-sm text-muted-foreground">@{p.username}</p>}
        {p.bio && <p className="mt-1 whitespace-pre-wrap text-sm">{p.bio}</p>}
      </div>

      {isSelf ? (
        <Link to="/profile" className="flex w-full items-center justify-center rounded-full bg-muted px-4 py-1.5 text-sm font-semibold transition active:scale-95">Edit profile</Link>
      ) : (<>
      <div className="grid grid-cols-2 gap-2 [&>*]:w-full">
        <FollowButton id={p.id} />
        <Link to="/chat/$id" params={{ id: p.id }} className="flex items-center justify-center gap-1.5 rounded-full bg-muted px-4 py-1.5 text-sm font-semibold transition active:scale-95">
          <MessageCircle className="h-4 w-4" /> Message
        </Link>
      </div>

      {mine?.status === "pending" && (
        <div className="flex items-center gap-3 rounded-2xl border p-4">
          <Eye className="h-5 w-5 text-primary" />
          <p className="flex-1 text-sm"><b>{name}</b> wants to see your plans</p>
          <button onClick={() => act(() => approve(id), "Access given")} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Accept</button>
          <button onClick={() => act(() => removeShare(share.data!.uid, id), "Request removed")} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Decline</button>
        </div>
      )}
      {mine?.status === "accepted" && (
        <div className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{name} can see your plans</span>
          <button onClick={() => act(() => removeShare(share.data!.uid, id), "Access removed")} className="font-semibold text-destructive">Remove</button>
        </div>
      )}
      {!mine && share.data && (
        <button onClick={() => act(() => approve(id), "They can now see your plans")} className="w-full rounded-2xl border border-dashed py-2.5 text-sm text-muted-foreground transition hover:bg-muted">
          Let {name} see your plans
        </button>
      )}
      </>)}

      {isSelf ? (
        <p className="border-t pt-4 text-center text-sm text-muted-foreground">This is how others see your profile.</p>
      ) : <div className="border-t pt-4">
        {canSee ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Plans</h2>
              <button onClick={() => act(() => removeShare(id, share.data!.uid), "Stopped viewing")} className="text-xs text-muted-foreground">Stop viewing</button>
            </div>
            {tasks.data?.length === 0 && <p className="text-sm text-muted-foreground">No plans yet.</p>}
            {tasks.data?.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                {t.done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <span className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                {t.due_at && <span className="text-xs text-muted-foreground">{new Date(t.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </div>
            ))}
          </section>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="rounded-full border-2 border-foreground p-3"><Lock className="h-6 w-6" /></div>
            <p className="font-semibold">This account's plans are private</p>
            <p className="text-sm text-muted-foreground">Memories are always private.</p>
            {theirs?.status === "pending" ? (
              <button onClick={() => act(() => removeShare(id, share.data!.uid), "Request cancelled")} className="mt-2 rounded-full bg-muted px-4 py-1.5 text-sm font-semibold">Requested</button>
            ) : (
              <button onClick={() => act(() => requestAccess(id), "Request sent")} className="mt-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ask to see plans</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label, icon }: { n: number; label: string; icon?: boolean }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-0.5 font-display text-lg font-bold">{icon && <Flame className="h-4 w-4 text-primary" />}{n}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
