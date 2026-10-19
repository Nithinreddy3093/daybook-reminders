import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getThread, markRead, sendMessage } from "@/lib/messages";
import { getProfile } from "@/lib/social";
import { Avatar } from "@/components/ProfileCard";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  head: () => ({
    meta: [
      { title: "Chat — Keep" },
      { name: "description", content: "A private conversation on Keep." },
      { property: "og:title", content: "Chat — Keep" },
      { property: "og:description", content: "A private conversation on Keep." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const prof = useQuery({ queryKey: ["public-profile", id], queryFn: () => getProfile(id) });
  const thread = useQuery({ queryKey: ["thread", id], queryFn: () => getThread(id) });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ch = supabase.channel(`chat-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["thread", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const msgs = thread.data?.messages ?? [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    if (msgs.some((m) => m.sender_id === id && !m.read_at)) {
      markRead(id).then(() => { qc.invalidateQueries({ queryKey: ["unread"] }); qc.invalidateQueries({ queryKey: ["inbox"] }); });
    }
  }, [msgs, id, qc]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await sendMessage(id, text); setText(""); qc.invalidateQueries({ queryKey: ["thread", id] }); }
    catch { toast.error("Message not sent"); }
    finally { setBusy(false); }
  };

  const p = prof.data?.profile;
  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-4 flex items-center gap-3 border-b pb-3">
        <Link to="/messages" aria-label="Back" className="rounded-full p-1.5 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        {p && <Link to="/u/$id" params={{ id }} className="flex items-center gap-3">
          <Avatar p={p} size={40} />
          <div><p className="text-sm font-semibold">{p.display_name || p.username || "Keep user"}</p>
            {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}</div>
        </Link>}
      </div>
      <div className="flex-1 space-y-2">
        {thread.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!thread.isLoading && !msgs.length && <p className="py-10 text-center text-sm text-muted-foreground">Say hi 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_id !== id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-sm ${mine ? "bg-gradient-brand text-primary-foreground" : "bg-muted"}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        {msgs.length > 0 && msgs[msgs.length - 1].sender_id !== id && msgs[msgs.length - 1].read_at && (
          <p className="text-right text-[11px] text-muted-foreground">Seen</p>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="sticky bottom-20 mt-4 flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 md:bottom-4">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" maxLength={2000}
          className="flex-1 bg-transparent py-1.5 text-sm outline-none" />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="rounded-full p-1.5 text-primary disabled:opacity-40">
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
