import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getThread, markRead, sendMessage, type Message } from "@/lib/messages";
import { getProfile, liveStreak } from "@/lib/social";
import { Avatar } from "@/components/ProfileCard";
import { playSound } from "@/lib/sounds";

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

type Thread = { uid: string; messages: (Message & { pending?: boolean })[] };
const QUICK = ["❤️", "😂", "👍", "🔥"];

function isLooking() {
  return document.visibilityState === "visible" && document.hasFocus();
}

function ChatPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const key = ["thread", id];
  const prof = useQuery({ queryKey: ["public-profile", id], queryFn: () => getProfile(id) });
  const thread = useQuery({ queryKey: key, queryFn: () => getThread(id), staleTime: 0 });
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);

  const msgs: Thread["messages"] = thread.data?.messages ?? [];
  const uid = thread.data?.uid;

  // Realtime: patch the cache directly instead of refetching (faster, no flicker).
  useEffect(() => {
    const ch = supabase.channel(`chat-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        const row = p.new as Message;
        if (!row?.id || (row.sender_id !== id && row.recipient_id !== id)) return;
        qc.setQueryData<Thread>(key, (old) => {
          if (!old) return old;
          const list = old.messages.filter((m) => !(m.pending && m.content === row.content && m.sender_id === row.sender_id));
          const i = list.findIndex((m) => m.id === row.id);
          if (i >= 0) { const next = [...list]; next[i] = row; return { ...old, messages: next }; }
          return { ...old, messages: [...list, row] };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, qc]);

  // Mark as seen ONLY when this person is actually looking at the chat.
  const markIfLooking = useCallback(() => {
    const list = qc.getQueryData<Thread>(key)?.messages ?? [];
    if (!isLooking() || !list.some((m) => m.sender_id === id && !m.read_at)) return;
    markRead(id).then(() => { qc.invalidateQueries({ queryKey: ["unread"] }); qc.invalidateQueries({ queryKey: ["inbox"] }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, qc]);

  useEffect(() => { markIfLooking(); }, [msgs, markIfLooking]);
  useEffect(() => {
    const on = () => markIfLooking();
    document.addEventListener("visibilitychange", on);
    window.addEventListener("focus", on);
    return () => { document.removeEventListener("visibilitychange", on); window.removeEventListener("focus", on); };
  }, [markIfLooking]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !msgs.length) return;
    el.scrollTo({ top: el.scrollHeight, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [msgs.length]);

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || !uid) return;
    const temp: Message & { pending: boolean } = {
      id: `tmp-${Date.now()}`, sender_id: uid, recipient_id: id, content, read_at: null,
      created_at: new Date().toISOString(), pending: true,
    };
    qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: [...old.messages, temp] } : old);
    setText("");
    playSound("sent");
    input.current?.focus();
    try { await sendMessage(id, content); }
    catch {
      qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: old.messages.filter((m) => m.id !== temp.id) } : old);
      toast.error("Message not sent");
      setText(content);
    }
  };

  const p = prof.data?.profile;
  const last = msgs[msgs.length - 1];
  const lastMine = last && last.sender_id !== id;

  return (
    <div className="-mx-4 flex h-[calc(100dvh-4.5rem)] flex-col md:mx-0 md:h-[calc(100dvh-6rem)]">
      <div className="flex items-center gap-3 border-b px-4 pb-3">
        <Link to="/messages" aria-label="Back" className="rounded-full p-1.5 transition hover:bg-muted active:scale-90"><ArrowLeft className="h-5 w-5" /></Link>
        {p && <Link to="/u/$id" params={{ id }} className="flex min-w-0 items-center gap-3">
          <Avatar p={p} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{p.display_name || p.username || "Keep user"}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {p.username && <span>@{p.username}</span>}
              {liveStreak(p) > 0 && <span className="flex items-center gap-0.5"><Flame className="h-3 w-3 text-primary" />{liveStreak(p)}</span>}
            </p>
          </div>
        </Link>}
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: "touch" }}>
        {thread.isLoading && <div className="space-y-2">{[60, 40, 70].map((w, i) => <div key={i} className={`h-9 animate-pulse rounded-3xl bg-muted ${i % 2 ? "ml-auto" : ""}`} style={{ width: `${w}%` }} />)}</div>}
        {!thread.isLoading && !msgs.length && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            {p && <Avatar p={p} size={72} />}
            <p className="text-sm text-muted-foreground">Say hi 👋</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const mine = m.sender_id !== id;
          const prevSame = msgs[i - 1]?.sender_id === m.sender_id;
          const nextSame = msgs[i + 1]?.sender_id === m.sender_id;
          const emojiOnly = /^\p{Extended_Pictographic}{1,3}$/u.test(m.content);
          const r = mine
            ? `rounded-3xl ${prevSame ? "rounded-tr-md" : ""} ${nextSame ? "rounded-br-md" : ""}`
            : `rounded-3xl ${prevSame ? "rounded-tl-md" : ""} ${nextSame ? "rounded-bl-md" : ""}`;
          return (
            <div key={m.id} className={`keep-bubble-in flex ${mine ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-3"}`}>
              {emojiOnly ? (
                <span className={`text-4xl ${m.pending ? "opacity-60" : ""}`}>{m.content}</span>
              ) : (
                <div className={`max-w-[78%] whitespace-pre-wrap break-words px-4 py-2 text-[15px] leading-snug transition-opacity ${r} ${mine ? "bg-gradient-brand text-primary-foreground" : "bg-muted"} ${m.pending ? "opacity-70" : ""}`}>
                  {m.content}
                </div>
              )}
            </div>
          );
        })}
        {lastMine && (
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {"pending" in last && last.pending ? "Sending…" : last.read_at ? "Seen" : "Delivered"}
          </p>
        )}
      </div>

      <div className="border-t bg-background px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {!text && (
          <div className="mb-2 flex gap-2">
            {QUICK.map((e) => (
              <button key={e} type="button" onClick={() => send(e)} className="rounded-full bg-muted px-3 py-1 text-lg transition active:scale-90">{e}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 rounded-3xl border bg-background px-4 py-1.5">
          <textarea ref={input} value={text} rows={1} maxLength={2000} placeholder="Message…"
            onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            className="max-h-[120px] flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none" />
          <button type="submit" disabled={!text.trim()} aria-label="Send" className="rounded-full p-1.5 text-primary transition active:scale-90 disabled:opacity-40">
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
