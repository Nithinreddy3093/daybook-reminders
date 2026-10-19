import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Lock, Send } from "lucide-react";
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
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["inbox"], queryFn: getInbox });
  useEffect(() => {
    const ch = supabase.channel("inbox-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["inbox"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Messages</h1>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : !data?.threads.length ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
            <Send className="h-7 w-7" />
            <p className="font-semibold">No messages yet</p>
            <p className="text-sm text-muted-foreground">Open a friend's profile and tap Message.</p>
            <Link to="/friends" className="mt-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">Find friends</Link>
          </div>
        ) : (
          <div className="divide-y">
            {data.threads.map((t) => (
              <Link key={t.id} to="/chat/$id" params={{ id: t.id }} className="flex items-center gap-3 py-3">
                <Avatar p={t.profile ?? { id: t.id, display_name: "?", username: null, bio: null, streak: 0, last_active: null }} size={52} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${t.unread ? "font-bold" : "font-semibold"}`}>{t.profile?.display_name || t.profile?.username || "Keep user"}</p>
                  <p className={`truncate text-sm ${t.unread ? "text-foreground" : "text-muted-foreground"}`}>
                    {t.last.sender_id === data.uid ? "You: " : ""}{t.last.content}
                  </p>
                </div>
                {t.pendingPlans > 0 && <span className="rounded-full border border-primary px-2 py-0.5 text-xs font-semibold text-primary">📅 Plan request</span>}
                {t.unread > 0 && <span className="rounded-full bg-gradient-brand px-2 py-0.5 text-xs font-bold text-primary-foreground">{t.unread}</span>}
              </Link>
            ))}
          </div>
        )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Only you and your friend can read these. Plans and memories are never shared.</p>
    </div>
  );
}
