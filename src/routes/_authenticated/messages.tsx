import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Search, Send, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getInbox } from "@/lib/messages";
import { Avatar } from "@/components/ProfileCard";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Keep" },
      { name: "description", content: "Private messages with your Keep friends." },
      { property: "og:title", content: "Messages — Keep" },
      { property: "og:description", content: "Private messages with your Keep friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function preview(c: string) {
  if (/^https?:\/\/\S+\/u\/[\w-]+/.test(c)) return "Shared a profile";
  return c;
}

function InboxPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["inbox"], queryFn: getInbox });
  const [q, setQ] = useState("");
  useEffect(() => {
    const ch = supabase.channel("inbox-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["inbox"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const threads = useMemo(() => {
    const list = data?.threads ?? [];
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter((t) => `${t.profile?.display_name ?? ""} ${t.profile?.username ?? ""}`.toLowerCase().includes(n));
  }, [data, q]);
  const unreadTotal = (data?.threads ?? []).reduce((a, t) => a + (t.unread ? 1 : 0), 0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        {unreadTotal > 0 && <span className="text-sm font-semibold text-primary">{unreadTotal} unread</span>}
      </div>

      <label className="mb-4 flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm" />
      </label>

      {!!data?.threads.length && !q && (
        <div className="no-scrollbar -mx-4 mb-2 flex gap-4 overflow-x-auto px-4 pb-3">
          {data.threads.slice(0, 12).map((t) => t.profile && (
            <Link key={t.id} to="/chat/$id" params={{ id: t.id }} className="flex w-16 shrink-0 flex-col items-center gap-1 active:scale-95">
              <span className={`rounded-full p-[2px] ${t.unread ? "bg-gradient-brand" : "bg-border"}`}>
                <span className="block rounded-full bg-background p-[2px]"><Avatar p={t.profile} size={56} /></span>
              </span>
              <span className="w-full truncate text-center text-[11px]">{t.profile.display_name?.split(" ")[0] || t.profile.username}</span>
            </Link>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3"><div className="h-14 w-14 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /></div></div>
        ))}</div>
      ) : !data?.threads.length ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed p-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground"><Send className="h-7 w-7" /></span>
          <p className="mt-2 font-semibold">Your messages</p>
          <p className="text-sm text-muted-foreground">Send private messages and plans to a friend.</p>
          <Link to="/friends" className="mt-2 rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground">Find friends</Link>
        </div>
      ) : !threads.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No chats match “{q}”.</p>
      ) : (
        <ul className="-mx-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link to="/chat/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/60 active:bg-muted">
                <Avatar p={t.profile ?? { id: t.id, display_name: "?", username: null, bio: null, streak: 0, last_active: null }} size={56} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[15px] ${t.unread ? "font-bold" : "font-medium"}`}>{t.profile?.display_name || t.profile?.username || "Keep user"}</p>
                  <p className={`flex min-w-0 items-center gap-1 text-sm ${t.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {t.pendingPlans > 0 ? (
                      <span className="flex items-center gap-1 text-primary"><CalendarDays className="h-3.5 w-3.5" />Plan request waiting</span>
                    ) : (
                      <span className="truncate">{t.last.sender_id === data.uid ? "You: " : ""}{preview(t.last.content)}</span>
                    )}
                    <span className="shrink-0">· {ago(t.last.created_at)}</span>
                  </p>
                </div>
                {t.unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-brand" aria-label={`${t.unread} unread`} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Only you and your friend can read these.</p>
    </div>
  );
}
