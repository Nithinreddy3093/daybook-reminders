import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { QuickAdd } from "@/components/QuickAdd";
import { Home, ListChecks, Image as ImageIcon, User, Bell, Plus, X, Search, Send } from "lucide-react";
import { toggleTask } from "@/lib/tasks";
import { applyTheme, readTheme } from "@/lib/theme";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tasksQuery } from "@/lib/data";
import { unreadCount } from "@/lib/messages";

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
        if (!t.remind_at || t.done || fired.current.has(t.id)) return;
        const at = new Date(t.remind_at).getTime();
        if (at <= now && now - at < 1000 * 60 * 60 * 12) {
          fired.current.add(t.id);
          const snooze = async (min: number) => {
            await supabase.from("tasks").update({ remind_at: new Date(Date.now() + min * 60000).toISOString() }).eq("id", t.id);
            fired.current.delete(t.id);
            qc.invalidateQueries({ queryKey: ["tasks"] });
            toast(`Snoozed ${min >= 60 ? min / 60 + "h" : min + "m"}`);
          };
          toast(`⏰ ${t.title}`, {
            description: (
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="rounded-full border px-3 py-1 text-xs" onClick={() => snooze(15)}>Snooze 15m</button>
                <button className="rounded-full border px-3 py-1 text-xs" onClick={() => snooze(60)}>Snooze 1h</button>
                <button className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                  onClick={async () => { await toggleTask(t); qc.invalidateQueries({ queryKey: ["tasks"] }); toast("Marked done ✓"); }}>Done</button>
              </div>
            ),
            duration: 60000,
          });
          if ("Notification" in window && Notification.permission === "granted") {
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
  const askNotify = async () => {
    if (!("Notification" in window)) { toast.error("Notifications are not supported on this device"); return; }
    const p = await Notification.requestPermission();
    toast(p === "granted" ? "Notifications on" : "Notifications blocked");
  };

  return (
    <div className="min-h-screen bg-background">
      <ReminderWatcher />
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
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
            <button onClick={askNotify} aria-label="Enable notifications" className="rounded-full p-2 hover:bg-muted">
              <Bell className="h-5 w-5" />
            </button>
            <Link to="/profile" aria-label="Profile" className="rounded-full p-2 hover:bg-muted md:hidden">
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>
      <main className="keep-reveal mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</main>
      <QuickCapture />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around">
          {nav.map((n) => (
            <Link
              key={n.to}
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
    const ch = supabase.channel("unread-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["unread"] }))
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
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Quick capture"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-lg md:bottom-8 md:right-8">
        <Plus className="h-7 w-7" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 md:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg space-y-4 rounded-t-3xl bg-background p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">Quick capture</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <QuickAdd autoFocus onDone={() => setOpen(false)} />
            <button onClick={() => { setOpen(false); navigate({ to: "/memories" }); }}
              className="w-full rounded-full border py-2 text-sm font-medium hover:bg-muted">Save a photo, file or note instead</button>
          </div>
        </div>
      )}
    </>
  );
}
