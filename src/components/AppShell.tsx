import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { Home, ListChecks, Image as ImageIcon, LogOut, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tasksQuery } from "@/lib/data";

const nav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/plans", label: "Plans", icon: ListChecks },
  { to: "/memories", label: "Memories", icon: ImageIcon },
] as const;

function ReminderWatcher() {
  const { data: tasks } = useQuery(tasksQuery);
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      tasks?.forEach((t) => {
        if (!t.remind_at || t.done || fired.current.has(t.id)) return;
        const at = new Date(t.remind_at).getTime();
        if (at <= now && now - at < 1000 * 60 * 60 * 12) {
          fired.current.add(t.id);
          toast(`⏰ ${t.title}`, { description: "Reminder" });
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Reminder", { body: t.title, icon: "/icon-512.png" });
          }
        }
      });
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [tasks]);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
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
            <button onClick={askNotify} aria-label="Enable notifications" className="rounded-full p-2 hover:bg-muted">
              <Bell className="h-5 w-5" />
            </button>
            <button onClick={signOut} aria-label="Sign out" className="rounded-full p-2 hover:bg-muted">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</main>
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
