import { tap } from "@/lib/haptics";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { QuickAdd } from "@/components/QuickAdd";
import { ActivityBell } from "@/components/ActivityBell";
import { UsernameGate } from "@/components/UsernameGate";
import { StreakCelebration } from "@/components/StreakCelebration";
import { Home, ListChecks, Image as ImageIcon, User, Plus, X, Search, Send } from "lucide-react";
import { toggleTask } from "@/lib/tasks";
import { applyTheme, readTheme } from "@/lib/theme";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tasksQuery } from "@/lib/data";
import { unreadCount } from "@/lib/messages";
import { playSound, unlockAudioOnGesture } from "@/lib/sounds";

const nav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/plans", label: "Plans", icon: ListChecks },
  { to: "/memories", label: "Memories", icon: ImageIcon },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function ReminderWatcher() {
  const { data: tasks } = useQuery(tasksQuery);
  const qc = useQueryClient();
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      tasks?.forEach((t) => {
        if (!t.remind_at || t.done) return;
        const key = `${t.id}@${t.remind_at}`;
        if (fired.current.has(key)) return;
        if (t.reminded_for && +new Date(t.reminded_for) === +new Date(t.remind_at)) return;
        const at = new Date(t.remind_at).getTime();
        if (at <= now && now - at < 1000 * 60 * 60 * 12) {
          fired.current.add(key);
          // Mark as shown right away so reopening Keep or swiping it away won't show it again.
          void supabase.from("tasks").update({ reminded_for: t.remind_at }).eq("id", t.id).then(() => {});
          const snooze = async (min: number) => {
            await supabase.from("tasks").update({ remind_at: new Date(Date.now() + min * 60000).toISOString() }).eq("id", t.id);
            qc.invalidateQueries({ queryKey: ["tasks"] });
            toast(`Snoozed ${min >= 60 ? min / 60 + "h" : min + "m"}`);
          };
          toast(`⏰ ${t.title}`, {
            description: (
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="rounded-full border px-3 py-1 text-xs" onClick={() => snooze(15)}>Snooze 15m</button>
                <button className="rounded-full border px-3 py-1 text-xs" onClick={() => snooze(60)}>Snooze 1h</button>
                <button className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                  onClick={async () => { try { await toggleTask(t); toast("Marked done ✓"); } catch { toast.error("Couldn't update this task"); } qc.invalidateQueries({ queryKey: ["tasks"] }); }}>Done</button>
              </div>
            ),
            duration: 60000,
          });
          playSound("reminder");
          if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
            new Notification("Reminder", { body: t.title, icon: "/icon-512.png" });
          }
        }
      });
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [tasks, qc]);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => { applyTheme(readTheme()); }, []);
  useEffect(() => {
    unlockAudioOnGesture();
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "keep-push") playSound(e.data.sound === "received" ? "received" : "reminder"); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);
  const inChat = useRouterState({ select: (s) => s.location.pathname.startsWith("/chat/") });
  const showFab = useRouterState({ select: (s) => ["/home", "/plans"].includes(s.location.pathname) });

  return (
    <div className="min-h-screen bg-background">
      <ReminderWatcher />
      <UsernameGate />
      <StreakCelebration />
      <header className={`sticky top-0 z-30 border-b bg-background md:bg-background/90 md:backdrop-blur ${inChat ? "hidden md:block" : ""}`}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/home" className="font-display text-2xl font-bold text-gradient-brand">
            Keep
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                activeProps={{ className: "text-foreground bg-muted" }}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link to="/friends" aria-label="Find friends" className="rounded-full p-2 hover:bg-muted">
              <Search className="h-5 w-5" />
            </Link>
            <InboxLink />
            <ActivityBell />
          </div>
        </div>
      </header>
      <main className={`keep-reveal mx-auto px-4 ${inChat ? "max-w-2xl pb-4 pt-3" : "max-w-5xl pb-36 pt-6 md:pb-28"}`}>{children}</main>
      {showFab && <QuickCapture />}
      <nav className={`fixed inset-x-0 bottom-0 z-30 border-t bg-background md:hidden ${inChat ? "hidden" : ""}`}>
        <div className="mx-auto flex h-16 max-w-md items-center justify-around">
          {nav.map((n) => (
            <Link
              key={n.to} onClick={() => tap()}
              to={n.to}
              aria-label={n.label}
              className="flex flex-col items-center gap-1 px-4 text-[11px] text-muted-foreground"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              <n.icon className="h-6 w-6" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function InboxLink() {
  const qc = useQueryClient();
  const { data: n = 0 } = useQuery({ queryKey: ["unread"], queryFn: unreadCount, refetchInterval: 60000 });
  useEffect(() => {
    let uid: string | undefined;
    supabase.auth.getUser().then(({ data }) => { uid = data.user?.id; });
    const ch = supabase.channel("unread-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (p) => {
        qc.invalidateQueries({ queryKey: ["unread"] });
        const row = p.new as { recipient_id?: string; sender_id?: string; content?: string } | undefined;
        if (p.eventType !== "INSERT" || !uid || row?.recipient_id !== uid || !row.sender_id) return;
        if (window.location.pathname === `/chat/${row.sender_id}` && document.visibilityState === "visible") return;
        playSound("received");
        const { data: prof } = await supabase.from("profiles").select("display_name, username").eq("id", row.sender_id).maybeSingle();
        const name = prof?.display_name || prof?.username || "New message";
        const body = String(row.content ?? "").slice(0, 100);
        const to = `/chat/${row.sender_id}`;
        toast(name, { description: body, action: { label: "Open", onClick: () => { window.location.href = to; } } });
        if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
          try { const n = new Notification(`💬 ${name}`, { body, icon: "/icon-512.png", tag: `chat-${row.sender_id}` }); n.onclick = () => { window.focus(); window.location.href = to; }; } catch { /* ignore */ }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return (
    <Link to="/messages" aria-label="Messages" className="relative rounded-full p-2 hover:bg-muted">
      <Send className="h-5 w-5" />
      {n > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] font-bold text-primary-foreground">{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}

function QuickCapture() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button onClick={() => { tap(); setOpen(true); }} aria-label="Quick capture"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 touch-manipulation items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-lg transition active:scale-95 md:bottom-8 md:right-8">
        <Plus className="h-7 w-7" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-foreground/40 md:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg space-y-4 rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">Quick capture</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <QuickAdd autoFocus={typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches} onDone={() => setOpen(false)} />
            <button onClick={() => { setOpen(false); navigate({ to: "/memories" }); }}
              className="w-full rounded-full border py-2 text-sm font-medium hover:bg-muted">Save a photo, file or note instead</button>
          </div>
        </div>
      )}
    </>
  );
}
