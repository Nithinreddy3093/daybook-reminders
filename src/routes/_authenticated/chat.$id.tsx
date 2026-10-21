import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Flame, CalendarPlus, Check, X, Sparkles, Loader2, Paperclip, FileText, Download, Plus, Mic, ChevronDown, ListChecks } from "lucide-react";
import { tap } from "@/lib/haptics";
import { useServerFn } from "@tanstack/react-start";
import { createCollabPlan, type CollabPlan } from "@/lib/ai.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendChecklist, updateChecklist } from "@/lib/messages";
import { ChatChecklist, type ChecklistItem } from "@/components/ChatChecklist";
import { fileUrl, reactMessage, sendFile, getThread, markRead, respondPlan, sendMessage, sendPlan, type Message } from "@/lib/messages";
import { getProfile, liveStreak } from "@/lib/social";
import { Avatar } from "@/components/ProfileCard";
import { ContactCard, PROFILE_LINK } from "@/components/ContactCard";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/lib/use-sheet";

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

// Shrink large phone photos before upload so sending is fast on mobile data.
async function shrinkImage(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || f.size < 1.5 * 1024 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= f.size) return f;
    return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return f; }
}

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

  const msgs: Thread["messages"] = (thread.data?.messages ?? []).filter((m) => !(uid && (m as Message).hidden_for?.includes(uid)));
  const uid = thread.data?.uid;
  // Follow the phone's visible area so the keyboard sits right under the composer.
  const [vvh, setVvh] = useState<number | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || window.matchMedia("(min-width: 768px)").matches) return;
    const on = () => { setVvh(vv.height); setKbOpen(window.innerHeight - vv.height > 120); window.scrollTo(0, 0); };
    on(); vv.addEventListener("resize", on); vv.addEventListener("scroll", on);
    const html = document.documentElement, body = document.body;
    const prev = [html.style.overflow, body.style.overflow, body.style.overscrollBehavior];
    html.style.overflow = "hidden"; body.style.overflow = "hidden"; body.style.overscrollBehavior = "none";
    return () => {
      vv.removeEventListener("resize", on); vv.removeEventListener("scroll", on);
      html.style.overflow = prev[0] ?? ""; body.style.overflow = prev[1] ?? ""; body.style.overscrollBehavior = prev[2] ?? "";
    };
  }, []);

  // Realtime: patch the cache directly instead of refetching (faster, no flicker).
  useEffect(() => {
    const ch = supabase.channel(`chat-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        if (p.eventType === "DELETE") {
          const gone = (p.old as { id?: string })?.id;
          if (gone) qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: old.messages.filter((m) => m.id !== gone) } : old);
          return;
        }
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

  // Presence (online dot) + typing broadcast, scoped to this pair.
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const room = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyped = useRef(0);
  useEffect(() => {
    if (!uid) return;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase.channel(`room-${[uid, id].sort().join("-")}`, { config: { presence: { key: uid } } });
    ch.on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState()).includes(id)))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.from !== id) return;
        setTyping(!!payload.on);
        clearTimeout(clear);
        if (payload.on) clear = setTimeout(() => setTyping(false), 3000);
      })
      .subscribe((st) => { if (st === "SUBSCRIBED") ch.track({ at: Date.now() }); });
    room.current = ch;
    return () => { clearTimeout(clear); room.current = null; supabase.removeChannel(ch); };
  }, [uid, id]);
  const ping = (on: boolean) => {
    if (localStorage.getItem("keep-typing") === "off") return;
    if (on && Date.now() - lastTyped.current < 1500) return;
    lastTyped.current = on ? Date.now() : 0;
    room.current?.send({ type: "broadcast", event: "typing", payload: { from: uid, on } });
  };
  useEffect(() => { if (typing) scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [typing]);

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    if (fileInput.current) fileInput.current.value = "";
    await Promise.all(list.map(async (raw) => {
      if (raw.size > 50 * 1024 * 1024) { toast.error(`${raw.name} is over 50 MB`); return; }
      setUploading((n) => n + 1);
      try { const f = await shrinkImage(raw); await sendFile(id, f); }
      catch { toast.error(`Could not send ${raw.name}`); }
      finally { setUploading((n) => n - 1); }
    }));
  };

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
    ping(false);
   
    tap();
    if (input.current) { input.current.style.height = "auto"; input.current.focus(); }
    try { await sendMessage(id, content); }
    catch {
      qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: old.messages.filter((m) => m.id !== temp.id) } : old);
      toast.error("Message not sent");
      setText(content);
    }
  };

  const [planOpen, setPlanOpen] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pWhen, setPWhen] = useState("");
  const proposePlan = async () => {
    if (!pTitle.trim()) return;
    const at = pWhen ? new Date(pWhen).toISOString() : null;
    try { await sendPlan(id, { title: pTitle, due_at: at, remind_at: at }); setPlanOpen(false); setPTitle(""); setPWhen(""); }
    catch { toast.error("Could not send plan"); }
  };
  const aiFn = useServerFn(createCollabPlan);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [draft, setDraft] = useState<CollabPlan | null>(null);
  const runAi = async (idea: string) => {
    if (!idea.trim()) return;
    setAiBusy(true); setDraft(null);
    try {
      const r = await aiFn({ data: { text: idea, now: new Date().toString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (r.plan) setDraft(r.plan); else toast.error(r.error || "AI couldn't plan that");
    } catch { toast.error("AI couldn't plan that"); }
    finally { setAiBusy(false); }
  };
  const sendDraft = async () => {
    if (!draft) return;
    try { await sendPlan(id, draft); toast("Plan sent — waiting for their approval"); setDraft(null); setAiText(""); setAiOpen(false); }
    catch { toast.error("Could not send plan"); }
  };
  const answer = async (mid: string, ok: boolean) => {
    qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: old.messages.map((m) => m.id === mid ? { ...m, plan_status: ok ? "accepted" : "declined" } : m) } : old);
    try { await respondPlan(mid, ok); if (ok) { toast("Added to both your plans"); qc.invalidateQueries({ queryKey: ["tasks"] }); } }
    catch { toast.error("Could not update plan"); qc.invalidateQueries({ queryKey: key }); }
  };

  const [listOpen, setListOpen] = useState(false);
  const [lTitle, setLTitle] = useState("");
  const [lItems, setLItems] = useState("");
  const createList = async () => {
    const items = lItems.split("\n");
    if (!items.some((t) => t.trim())) return;
    try { await sendChecklist(id, lTitle, items); setListOpen(false); setLTitle(""); setLItems(""); }
    catch { toast.error("Could not send checklist"); }
  };
  const patchItems = (mid: string, fn: (items: ChecklistItem[]) => ChecklistItem[]) =>
    qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: old.messages.map((m) => m.id === mid && m.plan ? { ...m, plan: { ...m.plan, items: fn(((m.plan as { items?: ChecklistItem[] }).items) ?? []) } as NonNullable<Message["plan"]> } : m) } : old);
  const toggleItem = async (mid: string, item: string) => {
    patchItems(mid, (items) => items.map((i) => i.id === item ? { ...i, done: !i.done, by: i.done ? null : uid ?? null } : i));
    try { await updateChecklist(mid, item); } catch { toast.error("Couldn't update"); qc.invalidateQueries({ queryKey: key }); }
  };
  const addItem = async (mid: string, text: string) => {
    try { await updateChecklist(mid, null, text); } catch { toast.error("Couldn't add item"); }
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [heart, setHeart] = useState<string | null>(null);
  const react = async (mid: string, emoji = "❤️", likeOnly = false) => {
    if (!uid || mid.startsWith("tmp-")) return;
    const cur = msgs.find((m) => m.id === mid)?.reactions ?? {};
    const removing = cur[uid] === emoji;
    if (likeOnly && removing) { tap(8); setHeart(mid); setTimeout(() => setHeart(null), 700); return; }
    if (!removing) { tap([8, 40, 8]); setHeart(mid); setTimeout(() => setHeart(null), 700); }
    const next = { ...cur }; if (removing) delete next[uid]; else next[uid] = emoji;
    qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: old.messages.map((m) => m.id === mid ? { ...m, reactions: next } : m) } : old);
    try { await reactMessage(mid, emoji); } catch { toast.error("Couldn't react"); qc.invalidateQueries({ queryKey: key }); }
  };
  // Unsend / remove for me
  const [actionMsg, setActionMsg] = useState<Message | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = (m: Message) => { if (m.id.startsWith("tmp-")) return; press.current = setTimeout(() => { tap(15); setActionMsg(m); }, 500); };
  const endPress = () => { if (press.current) clearTimeout(press.current); press.current = null; };
  const removeMsg = async (m: Message, forAll: boolean) => {
    setActionMsg(null);
    const prev = qc.getQueryData<Thread>(key);
    qc.setQueryData<Thread>(key, (old) => old ? { ...old, messages: old.messages.filter((x) => x.id !== m.id) } : old);
    try {
      if (forAll) {
        const { error, count } = await supabase.from("messages").delete({ count: "exact" }).eq("id", m.id);
        if (error || !count) throw error ?? new Error("not deleted");
        if (m.attachment?.path) await supabase.storage.from("chat-files").remove([m.attachment.path]);
        toast("Message unsent");
      } else {
        const { error } = await supabase.rpc("hide_message", { _msg: m.id });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch { qc.setQueryData(key, prev); toast.error("Couldn't remove message"); }
  };
  const lastTap = useRef<{ id: string; t: number }>({ id: "", t: 0 });
  const lastTouch = useRef(0);
  const onBubbleTouch = (mid: string, e: React.TouchEvent) => {
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    lastTouch.current = now;
    if (lastTap.current.id === mid && now - lastTap.current.t < 350) { e.preventDefault(); lastTap.current = { id: "", t: 0 }; react(mid, "❤️", true); }
    else lastTap.current = { id: mid, t: now };
  };
  const onBubbleDbl = (mid: string) => { if (Date.now() - lastTouch.current > 800) react(mid, "❤️", true); };

  // Voice notes
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const rec = useRef<{ mr: MediaRecorder; chunks: Blob[]; keep: boolean; timer: ReturnType<typeof setInterval> } | null>(null);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const r = { mr, chunks: [] as Blob[], keep: false, timer: setInterval(() => setRecSecs((s) => s + 1), 1000) };
      mr.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
      mr.onstop = async () => {
        clearInterval(r.timer); stream.getTracks().forEach((t) => t.stop());
        setRecording(false); setRecSecs(0); rec.current = null;
        if (!r.keep || !r.chunks.length) return;
        const mime = mr.mimeType || "audio/webm";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const f = new File(r.chunks, `voice-${Date.now()}.${ext}`, { type: mime.split(";")[0] || "audio/webm" });
        setUploading((n) => n + 1);
        try { await sendFile(id, f); } catch { toast.error("Voice note not sent"); }
        finally { setUploading((n) => n - 1); }
      };
      rec.current = r; mr.start(); tap(); setRecording(true);
    } catch { toast.error("Microphone not available"); }
  };
  const stopRec = (keep: boolean) => { if (!rec.current) return; rec.current.keep = keep; tap(); rec.current.mr.stop(); };

  const p = prof.data?.profile;
  const last = msgs[msgs.length - 1];
  const lastMine = last && last.sender_id !== id;

  return (
    <div style={vvh ? { height: `${vvh}px` } : undefined} className="fixed inset-x-0 top-0 z-20 flex h-[100dvh] flex-col overscroll-none bg-background pt-[env(safe-area-inset-top)] md:static md:z-auto md:h-[calc(100dvh-6rem)] md:pt-0">
      <div className="flex items-center gap-3 border-b px-4 pb-3 pt-2 md:pt-0">
        <Link to="/messages" aria-label="Back" className="rounded-full p-1.5 transition hover:bg-muted active:scale-90"><ArrowLeft className="h-5 w-5" /></Link>
        {p && <Link to="/u/$id" params={{ id }} className="flex min-w-0 items-center gap-3">
          <span className="relative"><Avatar p={p} size={40} />{online && <span aria-label="Online" className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-[hsl(142_70%_45%)]" />}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{p.display_name || p.username || "Keep user"}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {typing ? <span className="font-medium text-primary">typing…</span> : online ? <span className="font-medium text-[hsl(142_70%_40%)]">Active now</span> : null}
              {!typing && !online && p.username && <span>@{p.username}</span>}
              {liveStreak(p) > 0 && <span className="flex items-center gap-0.5"><Flame className="h-3 w-3 text-primary" />{liveStreak(p)}</span>}
            </p>
          </div>
        </Link>}
      </div>

      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; const b = el.scrollHeight - el.scrollTop - el.clientHeight < 120; if (b !== atBottom) setAtBottom(b); }}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 [transform:translateZ(0)]" style={{ WebkitOverflowScrolling: "touch" }}>
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
          const d = new Date(m.created_at);
          const pd = msgs[i - 1] ? new Date(msgs[i - 1]!.created_at) : null;
          const gap = !pd || d.getTime() - pd.getTime() > 60 * 60 * 1000 || d.toDateString() !== pd.toDateString();
          const today = new Date(); const yest = new Date(Date.now() - 864e5);
          const label = d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === yest.toDateString() ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          return (
            <div key={m.id}>
            {gap && <p className="mb-1 mt-5 text-center text-[11px] font-medium text-muted-foreground">{label} · {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>}
            <div className={`relative flex ${i === msgs.length - 1 ? "keep-bubble-in" : ""} ${mine ? "justify-end" : "justify-start"} ${prevSame && !gap ? "mt-0.5" : "mt-3"} ${m.reactions && Object.keys(m.reactions).length ? "mb-3" : ""}`}
>
              <div className="relative max-w-[78%] select-none [-webkit-touch-callout:none]" onDoubleClick={() => onBubbleDbl(m.id)} onTouchStart={() => startPress(m)} onTouchMove={endPress} onTouchEnd={(e) => { endPress(); onBubbleTouch(m.id, e); }} onContextMenu={(e) => { e.preventDefault(); if (!m.id.startsWith("tmp-")) setActionMsg(m); }} style={{ touchAction: "manipulation" }}>
              {heart === m.id && <span className="keep-heart absolute left-1/2 top-1/2 z-10 -ml-5 -mt-6 text-4xl">❤️</span>}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); if (uid && m.reactions?.[uid]) react(m.id, m.reactions[uid]); }}
                  aria-label="Reactions" className={`absolute -bottom-3 z-10 flex items-center gap-0.5 rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm ${mine ? "right-2" : "left-2"}`}>
                  {[...new Set(Object.values(m.reactions))].join("")}{Object.keys(m.reactions).length > 1 && <span className="text-[10px] text-muted-foreground">{Object.keys(m.reactions).length}</span>}
                </button>
              )}
              {m.kind === "checklist" && m.plan ? (
                <ChatChecklist title={m.plan.title} items={((m.plan as { items?: ChecklistItem[] }).items) ?? []} pending={!!m.pending}
                  onToggle={(it) => toggleItem(m.id, it)} onAdd={(t) => addItem(m.id, t)} />
              ) : m.kind === "plan" && m.plan ? (
                <div className={`w-64 overflow-hidden rounded-3xl border bg-background ${m.pending ? "opacity-70" : ""}`}>
                  <div className="bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground">📅 Plan together</div>
                  <div className="space-y-1 px-4 py-3">
                    <p className="font-semibold">{m.plan.title}</p>
                    {m.plan.due_at && <p className="text-xs text-muted-foreground">{new Date(m.plan.due_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
                    {m.plan.notes && <p className="whitespace-pre-wrap pt-1 text-xs text-muted-foreground">{m.plan.notes}</p>}
                    {m.plan_status === "pending" && !mine && (
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => answer(m.id, true)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-foreground active:scale-95"><Check className="h-3.5 w-3.5" />Accept</button>
                        <button onClick={() => answer(m.id, false)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-muted py-1.5 text-xs font-semibold active:scale-95"><X className="h-3.5 w-3.5" />Decline</button>
                      </div>
                    )}
                    {m.plan_status === "pending" && mine && <p className="pt-1 text-xs text-muted-foreground">Waiting for them to accept…</p>}
                    {m.plan_status === "accepted" && <p className="pt-1 text-xs font-semibold text-primary">✓ Added to both your plans</p>}
                    {m.plan_status === "declined" && <p className="pt-1 text-xs text-muted-foreground">Declined</p>}
                  </div>
                </div>
              ) : m.kind !== "file" && uid && PROFILE_LINK.test(m.content) ? (
                <div className={m.pending ? "opacity-70" : ""}><ContactCard id={m.content.match(PROFILE_LINK)?.[1] ?? ""} myId={uid ?? ""} /></div>
              ) : emojiOnly ? (
                <span className={`text-4xl ${m.pending ? "opacity-60" : ""}`}>{m.content}</span>
              ) : m.kind === "file" && m.attachment ? (
                <AttachmentBubble a={m.attachment} mine={mine} caption={/^(📷 Photo|🎬 Video|🎤 Voice note|📎 )/u.test(m.content) ? "" : m.content} />
              ) : (
                <div className={`relative whitespace-pre-wrap break-words px-4 py-2 text-[15px] leading-snug transition-opacity ${r} ${mine ? "bg-gradient-brand text-primary-foreground" : "bg-muted"} ${m.pending ? "opacity-70" : ""}`}>
                  {m.content}
                </div>
              )}
              </div>
            </div>
            </div>
          );
        })}
        {uploading > 0 && <div className="mt-2 flex justify-end"><div className="flex items-center gap-2 rounded-3xl bg-muted px-4 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending {uploading > 1 ? `${uploading} files` : "file"}…</div></div>}
        {typing && <div className="keep-bubble-in mt-3 flex"><div className="flex gap-1 rounded-3xl bg-muted px-4 py-3">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 150}ms` }} />)}</div></div>}
        {lastMine && !typing && (
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {"pending" in last && last.pending ? "Sending…" : last.read_at ? "Seen" : "Delivered"}
          </p>
        )}
      </div>

      {actionMsg && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-foreground/40 p-6" onClick={() => setActionMsg(null)}>
          <div className="w-full max-w-xs overflow-hidden rounded-3xl bg-background text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="line-clamp-2 border-b px-4 py-3 text-sm text-muted-foreground">{actionMsg.content}</p>
            {actionMsg.sender_id === uid && (
              <button onClick={() => removeMsg(actionMsg, true)} className="w-full border-b py-3 text-sm font-semibold text-destructive active:bg-muted">Unsend for everyone</button>
            )}
            <button onClick={() => removeMsg(actionMsg, false)} className="w-full border-b py-3 text-sm font-medium active:bg-muted">Remove for me</button>
            <button onClick={() => setActionMsg(null)} className="w-full py-3 text-sm active:bg-muted">Cancel</button>
          </div>
        </div>, document.body)}
      <div className={`relative border-t bg-background px-3 pt-2 ${kbOpen ? "pb-2" : "pb-[max(0.5rem,env(safe-area-inset-bottom))]"}`}>
        {!atBottom && (
          <button type="button" aria-label="Scroll to latest" onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })}
            className="keep-bubble-in absolute -top-12 right-4 rounded-full border bg-background p-2 shadow-lg active:scale-90"><ChevronDown className="h-5 w-5" /></button>
        )}
        {planOpen && (
          <div className="keep-bubble-in mb-2 space-y-2 rounded-2xl border p-3">
            <input autoFocus value={pTitle} onChange={(e) => setPTitle(e.target.value)} maxLength={200} placeholder="What should we plan?" className="w-full bg-transparent text-sm outline-none" />
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={pWhen} onChange={(e) => setPWhen(e.target.value)} className="flex-1 rounded-lg bg-muted px-2 py-1 text-xs" />
              <button type="button" onClick={() => setPlanOpen(false)} className="rounded-full px-3 py-1 text-xs">Cancel</button>
              <button type="button" onClick={proposePlan} disabled={!pTitle.trim()} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">Send</button>
            </div>
          </div>
        )}
        {aiOpen && (
          <div className="keep-bubble-in mb-2 space-y-2 rounded-2xl border p-3">
            <p className="flex items-center gap-1 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" />Tell AI what you want to plan together</p>
            <div className="flex flex-wrap gap-1.5">
              {["Coffee catch-up this weekend", "Workout together tomorrow 7am", "Study session tonight 8pm", "Movie night Friday"].map((c) => (
                <button key={c} type="button" onClick={() => { setAiText(c); runAi(c); }} className="rounded-full bg-muted px-2.5 py-1 text-xs active:scale-95">{c}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); runAi(aiText); }} className="flex gap-2">
              <input autoFocus value={aiText} onChange={(e) => setAiText(e.target.value)} maxLength={500} placeholder="e.g. dinner Saturday 7:30pm downtown" className="flex-1 rounded-lg bg-muted px-3 py-1.5 text-sm outline-none" />
              <button type="submit" disabled={aiBusy || !aiText.trim()} className="rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40">{aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Plan"}</button>
            </form>
            {draft && (
              <div className="rounded-xl bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{draft.title}</p>
                {draft.due_at && <p className="text-xs text-muted-foreground">{new Date(draft.due_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
                {draft.notes && <p className="whitespace-pre-wrap pt-1 text-xs text-muted-foreground">{draft.notes}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setDraft(null)} className="rounded-full px-3 py-1 text-xs">Discard</button>
                  <button type="button" onClick={sendDraft} className="rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold text-primary-foreground">Send for approval</button>
                </div>
              </div>
            )}
            <div className="flex justify-end"><button type="button" onClick={() => { setAiOpen(false); setDraft(null); }} className="text-xs text-muted-foreground">Close</button></div>
          </div>
        )}
        {listOpen && (
          <div className="keep-bubble-in mb-2 space-y-2 rounded-2xl border p-3">
            <input value={lTitle} onChange={(e) => setLTitle(e.target.value)} maxLength={120} placeholder="Checklist name (e.g. Trip packing)" className="w-full bg-transparent text-sm font-semibold outline-none" />
            <textarea value={lItems} onChange={(e) => setLItems(e.target.value)} rows={3} placeholder={"One item per line\nTickets\nSnacks"} className="w-full resize-none rounded-lg bg-muted px-2 py-1.5 text-sm outline-none" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setListOpen(false)} className="rounded-full px-3 py-1 text-xs">Cancel</button>
              <button type="button" onClick={createList} disabled={!lItems.trim()} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">Send</button>
            </div>
          </div>
        )}
        {menuOpen && !planOpen && !aiOpen && !listOpen && (
          <div className="keep-bubble-in mb-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { tap(); setMenuOpen(false); fileInput.current?.click(); }} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-medium active:scale-90"><Paperclip className="h-4 w-4" />Photo / file</button>
            <button type="button" onClick={() => { tap(); setMenuOpen(false); setPlanOpen(true); }} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-medium active:scale-90"><CalendarPlus className="h-4 w-4" />Plan</button>
            <button type="button" onClick={() => { tap(); setMenuOpen(false); setListOpen(true); }} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-medium active:scale-90"><ListChecks className="h-4 w-4" />Checklist</button>
            <button type="button" onClick={() => { tap(); setMenuOpen(false); setAiOpen(true); }} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-medium active:scale-90"><Sparkles className="h-4 w-4 text-primary" />AI Plan</button>
            {QUICK.map((e) => (
              <button key={e} type="button" onClick={() => { setMenuOpen(false); send(e); }} className="rounded-full bg-muted px-3 py-1 text-lg active:scale-90">{e}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-1.5 rounded-3xl border bg-background px-1.5 py-1.5">
          <input ref={fileInput} type="file" multiple hidden accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={(e) => pickFiles(e.target.files)} />
          <button type="button" onClick={() => { tap(); setMenuOpen((o) => !o); }} aria-label="More options" className={`rounded-full p-1.5 text-primary-foreground bg-gradient-brand transition-transform active:scale-90 ${menuOpen ? "rotate-45" : ""}`}><Plus className="h-5 w-5" /></button>
          {recording ? (
            <div className="flex flex-1 items-center gap-2 py-1.5 text-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              <span className="font-medium tabular-nums">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}</span>
              <button type="button" onClick={() => stopRec(false)} className="ml-auto rounded-full px-2 text-xs text-muted-foreground">Cancel</button>
            </div>
          ) : (
            <textarea ref={input} value={text} rows={1} maxLength={2000} placeholder="Message…" enterKeyHint="send"
              onFocus={() => setMenuOpen(false)}
              onChange={(e) => { setText(e.target.value); ping(!!e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onBlur={() => ping(false)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
              className="max-h-[120px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[15px] outline-none" />
          )}
          {recording ? (
            <button type="button" onClick={() => stopRec(true)} aria-label="Send voice note" className="rounded-full p-1.5 text-primary active:scale-90"><Send className="h-5 w-5" /></button>
          ) : text.trim() ? (
            <button type="submit" aria-label="Send" className="keep-bubble-in rounded-full p-1.5 text-primary active:scale-90"><Send className="h-5 w-5" /></button>
          ) : (
            <button type="button" onClick={startRec} aria-label="Record voice note" className="rounded-full p-1.5 text-muted-foreground transition hover:text-foreground active:scale-90"><Mic className="h-5 w-5" /></button>
          )}
        </form>
      </div>
    </div>
  );
}

function AttachmentBubble({ a, mine, caption }: { a: NonNullable<Message["attachment"]>; mine: boolean; caption: string }) {
  const url = useQuery({ queryKey: ["chat-file", a.path], queryFn: () => fileUrl(a.path), staleTime: 45 * 60 * 1000 });
  const [big, setBig] = useState(false);
  const img = a.type.startsWith("image/");
  const vid = a.type.startsWith("video/");
  const aud = a.type.startsWith("audio/");
  const size = a.size > 1048576 ? `${(a.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(a.size / 1024))} KB`;
  return (
    <div className="max-w-[78%] space-y-1">
      {aud ? (
        <div className={`rounded-3xl px-2 py-1.5 ${mine ? "bg-gradient-brand" : "bg-muted"}`}>
          {url.data ? <audio src={url.data} controls preload="metadata" className="h-10 w-60 max-w-full" /> : <div className="h-10 w-60 animate-pulse" />}
        </div>
      ) : img || vid ? (
        <div className="overflow-hidden rounded-3xl bg-muted">
          {!url.data ? <div className="h-48 w-56 animate-pulse" />
            : img ? <button type="button" onClick={() => setBig(true)}><img src={url.data} alt={a.name} loading="lazy" className="max-h-72 w-auto max-w-full object-cover" /></button>
            : <video src={url.data} controls playsInline preload="metadata" className="max-h-72 max-w-full" />}
        </div>
      ) : (
        <a href={url.data} target="_blank" rel="noreferrer" download={a.name} className={`flex items-center gap-3 rounded-3xl px-4 py-3 ${mine ? "bg-gradient-brand text-primary-foreground" : "bg-muted"}`}>
          <FileText className="h-7 w-7 shrink-0" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{a.name}</span><span className="text-xs opacity-80">{size}</span></span>
          <Download className="h-4 w-4 shrink-0" />
        </a>
      )}
      {caption && <p className={`px-2 text-sm ${mine ? "text-right" : ""}`}>{caption}</p>}
      {big && url.data && <PhotoViewer src={url.data} alt={a.name} onClose={() => setBig(false)} />}
    </div>
  );
}

function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useScrollLock(true);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-[100] grid place-items-center bg-background/95 p-4" style={{ height: "100dvh" }}>
      <button type="button" onClick={onClose} aria-label="Close photo" className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] rounded-full bg-muted p-2"><X className="h-5 w-5" /></button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] max-w-[92vw] rounded-xl object-contain" />
    </div>,
    document.body,
  );
}
