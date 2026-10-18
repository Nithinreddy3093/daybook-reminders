import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Download, LogOut, Moon, Sun, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tasksQuery, memoriesQuery } from "@/lib/data";
import { BADGES, memoryStreak } from "@/lib/badges";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";
import { buildExport, downloadFile } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Keep" },
      { name: "description", content: "Your profile, badges, theme and backups." },
      { property: "og:title", content: "Profile — Keep" },
      { property: "og:description", content: "Your profile, badges, theme and backups." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(tasksQuery), context.queryClient.ensureQueryData(memoriesQuery)]),
  component: ProfilePage,
});

const profileQuery = {
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const id = u.user!.id;
    const [{ data }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
    ]);
    return { id, email: u.user!.email ?? "", display_name: data?.display_name ?? "", bio: data?.bio ?? "", username: data?.username ?? "", followers: followers ?? 0, following: following ?? 0 };
  },
};

function ProfilePage() {
  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const { data: memories } = useSuspenseQuery(memoriesQuery);
  const { data: profile } = useQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [perm, setPerm] = useState<string>("default");
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setTheme(readTheme()); setPerm("Notification" in window ? Notification.permission : "unsupported"); }, []);
  useEffect(() => { if (profile) { setName(profile.display_name); setBio(profile.bio); setUsername(profile.username); } }, [profile]);

  const stats = {
    doneTasks: tasks.filter((t) => t.done).length,
    memories: memories.length,
    streak: memoryStreak(memories.map((m) => m.created_at)),
  };
  const initials = (name || profile?.email || "?").slice(0, 2).toUpperCase();

  const save = async () => {
    if (!profile) return;
    const un = username.trim().toLowerCase();
    if (un && !/^[a-z0-9_.]{3,24}$/.test(un)) { toast.error("Username: 3–24 letters, numbers, _ or ."); return; }
    const { error } = await supabase.from("profiles").upsert({ id: profile.id, display_name: name.trim().slice(0, 60), username: un || null, bio: bio.trim().slice(0, 200), updated_at: new Date().toISOString() });
    if (error) { toast.error(error.code === "23505" ? "That username is taken" : error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast("Profile saved");
  };

  const pickTheme = (t: Theme) => { applyTheme(t); setTheme(t); };

  const askNotify = async () => {
    if (!("Notification" in window)) { toast.error("Notifications are not supported on this device"); return; }
    if (window.top !== window.self) { toast("Open the app in its own tab to allow notifications"); return; }
    const p = await Notification.requestPermission();
    setPerm(p);
    toast(p === "granted" ? "Notifications on" : "Notifications blocked — allow them in your browser's site settings");
  };

  const doExport = async (f: "json" | "csv") => {
    setExporting(true);
    try { downloadFile(await buildExport(f)); toast("Backup downloaded"); }
    catch { toast.error("Could not create backup"); }
    finally { setExporting(false); }
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-5">
        <div className="ring-gradient shrink-0">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background font-display text-2xl font-bold">{initials}</div>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{name || "Your profile"}</h1>
          <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
          <div className="mt-2 flex gap-5 text-sm">
            <span><b>{stats.doneTasks}</b> done</span>
            <span><b>{stats.memories}</b> memories</span>
            <span><b>{stats.streak}</b> day streak</span>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">About you</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" maxLength={60}
          className="w-full rounded-xl border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" maxLength={200} rows={2}
          className="w-full rounded-xl border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={save} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Save</button>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Badges</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BADGES.map((b) => {
            const on = b.test(stats);
            return (
              <div key={b.id} className={`rounded-2xl border p-4 ${on ? "" : "opacity-40 grayscale"}`}>
                <p className="text-3xl">{b.emoji}</p>
                <p className="mt-2 text-sm font-semibold">{b.label}</p>
                <p className="text-xs text-muted-foreground">{on ? "Unlocked" : b.hint}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {([["light", "Light", Sun], ["dark", "Dark", Moon], ["oled", "OLED black", Smartphone]] as const).map(([t, l, I]) => (
            <button key={t} onClick={() => pickTheme(t)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-sm ${theme === t ? "border-foreground font-semibold" : "text-muted-foreground"}`}>
              <I className="h-5 w-5" />{l}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Status: <b>{perm === "granted" ? "On" : perm === "denied" ? "Blocked" : perm === "unsupported" ? "Not supported" : "Off"}</b>. Reminders alert you while Keep is open, with snooze buttons.
        </p>
        {perm !== "granted" && (
          <button onClick={askNotify} className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground">
            <Bell className="h-4 w-4" /> Turn on notifications
          </button>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">Backup & export</h2>
        <p className="text-sm text-muted-foreground">Download all your plans and memories. File links stay valid for 7 days.</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={exporting} onClick={() => doExport("json")} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><Download className="h-4 w-4" /> JSON</button>
          <button disabled={exporting} onClick={() => doExport("csv")} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><Download className="h-4 w-4" /> CSV</button>
        </div>
      </section>

      <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium hover:bg-muted">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
