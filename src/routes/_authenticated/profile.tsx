import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Camera, Download, LogOut, Moon, Sun, Smartphone } from "lucide-react";
import { photoToAvatar, useAvatar } from "@/lib/avatars";
import { approve, myShares, removeShare } from "@/lib/shares";
import { ProfileRow } from "@/components/ProfileCard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tasksQuery, memoriesQuery } from "@/lib/data";
import { BADGES, memoryStreak } from "@/lib/badges";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";
import { buildExport, downloadFile } from "@/lib/export";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";
import { sendTestPush } from "@/lib/push.functions";
import { getMyStreak } from "@/lib/social";

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
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const { data: myStreak = 0 } = useQuery({ queryKey: ["my-streak"], queryFn: getMyStreak });
  const avatar = useAvatar(profile?.id);
  const { data: shares = [] } = useQuery({ queryKey: ["my-shares"], queryFn: myShares });

  useEffect(() => {
    setTheme(readTheme());
    setSound(localStorage.getItem("keep-sound") !== "off");
    setPerm(pushSupported() ? Notification.permission : "Notification" in window ? Notification.permission : "unsupported");
    currentSubscription().then((s) => setPushOn(!!s)).catch(() => {});
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) { await disablePush(); setPushOn(false); toast("Closed-app reminders off"); }
      else { await enablePush(); setPushOn(true); setPerm("granted"); toast("Closed-app reminders on"); }
    } catch (e) {
      const m = (e as Error).message;
      if (m === "iframe") toast("Open Keep in its own tab (or from your home screen) to turn this on");
      else if (m === "denied") { setPerm(Notification.permission); toast.error("Notifications are blocked — allow them in your browser settings"); }
      else if (m === "unsupported") toast.error("This browser can't receive push. On iPhone, add Keep to your home screen first.");
      else toast.error("Could not turn on reminders");
    } finally { setPushBusy(false); }
  };
  const testPush = async () => {
    try { const r = await sendTestPush(); toast(r.sent ? "Test sent — check your notifications" : "No device found, try turning it off and on"); }
    catch { toast.error("Test failed"); }
  };
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

  const changePhoto = async (f: File) => {
    if (!profile) return;
    try {
      const url = await photoToAvatar(f);
      const { error } = await supabase.from("profiles").upsert({ id: profile.id, avatar: url, updated_at: new Date().toISOString() });
      if (error) throw error;
      qc.setQueryData(["avatar", profile.id], url);
      toast("Photo updated");
    } catch { toast.error("Could not use that photo"); }
  };
  const removePhoto = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ avatar: null }).eq("id", profile.id);
    qc.setQueryData(["avatar", profile.id], null);
  };
  const shareAct = async (fn: () => Promise<void>) => {
    try { await fn(); qc.invalidateQueries({ queryKey: ["my-shares"] }); } catch { toast.error("Something went wrong"); }
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
        <label className="ring-gradient relative shrink-0 cursor-pointer" title="Change photo">
          {avatar ? <img src={avatar} alt="" className="h-20 w-20 rounded-full object-cover" />
            : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background font-display text-2xl font-bold">{initials}</div>}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Camera className="h-3 w-3" /></span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) changePhoto(f); e.target.value = ""; }} />
        </label>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{name || "Your profile"}</h1>
          <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
          <div className="mt-2 flex gap-5 text-sm">
            <span><b>{stats.doneTasks}</b> done</span>
            <span><b>{stats.memories}</b> memories</span>
            <span><b>🔥{myStreak}</b> streak</span>
          </div>
          {profile && <div className="mt-1 flex gap-5 text-sm">
            <Link to="/follows/$id" params={{ id: profile.id }} search={{ tab: "followers" }}><b>{profile.followers}</b> followers</Link>
            <Link to="/follows/$id" params={{ id: profile.id }} search={{ tab: "following" }}><b>{profile.following}</b> following</Link>
          </div>}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">About you</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" maxLength={60}
          className="w-full rounded-xl border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username (so friends can find you)" maxLength={24}
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
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">
            <b>Reminders when Keep is closed</b>
            <span className="block text-muted-foreground">
              {pushOn ? "On for this device." : perm === "denied" ? "Blocked — allow notifications in your browser settings." : perm === "unsupported" ? "Not supported here. On iPhone, add Keep to your home screen first." : "Get Plans reminders on this device even when Keep is closed."}
            </span>
          </span>
          <input type="checkbox" role="switch" checked={pushOn} disabled={pushBusy} onChange={togglePush} className="h-6 w-11 shrink-0 accent-primary" />
        </label>
        {pushOn && (
          <button onClick={testPush} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted">
            <Bell className="h-4 w-4" /> Send a test notification
          </button>
        )}
        <label className="flex items-center justify-between gap-4 border-t pt-3">
          <span className="text-sm"><b>Opening sound</b><span className="block text-muted-foreground">Soft chime with the opening animation.</span></span>
          <input type="checkbox" role="switch" checked={sound} onChange={(e) => { setSound(e.target.checked); localStorage.setItem("keep-sound", e.target.checked ? "on" : "off"); }} className="h-6 w-11 shrink-0 accent-primary" />
        </label>
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
