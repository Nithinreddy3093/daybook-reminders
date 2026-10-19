import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/lib/use-sheet";
import { Bell, Camera, Flame, Download, LogOut, Moon, Sun, Smartphone } from "lucide-react";
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
import { ShareSheet } from "@/components/ShareSheet";
import { incomingRequests, respondRequest } from "@/lib/friends";

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
    // Counts come from the same source as the followers/following lists so they always match.
    const [{ data }, counts] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.rpc("public_profile", { _id: id }),
    ]);
    const c = counts.data?.[0];
    return { id, email: u.user!.email ?? "", display_name: data?.display_name ?? "", bio: data?.bio ?? "", username: data?.username ?? "", followers: Number(c?.followers ?? 0), following: Number(c?.following ?? 0) };
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
  const [typingOn, setTypingOn] = useState(true);
  const { data: myStreak = 0 } = useQuery({ queryKey: ["my-streak"], queryFn: getMyStreak });
  const avatar = useAvatar(profile?.id);
  const { data: shares = [] } = useQuery({ queryKey: ["my-shares"], queryFn: myShares });
  const { data: requests = [] } = useQuery({ queryKey: ["friend-requests"], queryFn: incomingRequests });
  const answer = async (id: string, accept: boolean) => {
    qc.setQueryData(["friend-requests"], requests.filter((r) => r.id !== id));
    try {
      await respondRequest(id, accept);
      toast(accept ? "You're now friends" : "Request removed");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["following"] });
      qc.invalidateQueries({ queryKey: ["following-ids"] });
    } catch { toast.error("Something went wrong"); qc.invalidateQueries({ queryKey: ["friend-requests"] }); }
  };

  useEffect(() => {
    setTheme(readTheme());
    setSound(localStorage.getItem("keep-sound") !== "off");
    setTypingOn(localStorage.getItem("keep-typing") !== "off");
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

  const [editing, setEditing] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  useScrollLock(photoMenu || editing);
  const save = async () => {
    if (!profile) return false;
    const un = username.trim().toLowerCase();
    if (un && !/^[a-z0-9_.]{3,24}$/.test(un)) { toast.error("Username: 3–24 letters, numbers, _ or ."); return false; }
    const { error } = await supabase.from("profiles").upsert({ id: profile.id, display_name: name.trim().slice(0, 60), username: un || null, bio: bio.trim().slice(0, 200), updated_at: new Date().toISOString() });
    if (error) { toast.error(error.code === "23505" ? "That username is taken" : error.message); return false; }
    qc.setQueryData(["profile"], { ...profile, display_name: name.trim(), username: un, bio: bio.trim() });
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast("Profile saved");
    return true;
  };
  const [shareOpen, setShareOpen] = useState(false);
  const shareProfile = () => { if (profile) setShareOpen(true); };

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

  const fileRef = useRef<HTMLInputElement>(null);
  const pickPhoto = () => { setPhotoMenu(false); fileRef.current?.click(); };
  const avatarEl = (size: number) => avatar
    ? <img src={avatar} alt="" style={{ width: size, height: size }} className="rounded-full bg-muted object-cover" />
    : <div style={{ width: size, height: size, fontSize: size / 2.8 }} className="flex items-center justify-center rounded-full bg-background font-display font-bold">{initials}</div>;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-5 sm:gap-8">
          <button onClick={() => setPhotoMenu(true)} className="ring-gradient relative shrink-0 rounded-full" aria-label="Profile photo">
            <div className="rounded-full bg-background p-[3px]">{avatarEl(84)}</div>
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Camera className="h-3 w-3" /></span>
          </button>
          <div className="grid flex-1 grid-cols-3 text-center">
            <div><p className="flex items-center justify-center gap-0.5 font-display text-lg font-bold"><Flame className="h-4 w-4 text-primary" />{myStreak}</p><p className="text-xs text-muted-foreground">streak</p></div>
            {profile ? <Link to="/follows/$id" params={{ id: profile.id }} search={{ tab: "followers" }}><p className="font-display text-lg font-bold">{profile.followers}</p><p className="text-xs text-muted-foreground">followers</p></Link> : <div />}
            {profile ? <Link to="/follows/$id" params={{ id: profile.id }} search={{ tab: "following" }}><p className="font-display text-lg font-bold">{profile.following}</p><p className="text-xs text-muted-foreground">following</p></Link> : <div />}
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold">{profile?.display_name || "Your profile"}</h1>
          {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
          {profile?.bio && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{profile.bio}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{stats.doneTasks} done · {stats.memories} memories</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEditing(true)} className="rounded-xl bg-muted py-2 text-sm font-semibold transition active:scale-[.98]">Edit profile</button>
          <button onClick={shareProfile} className="rounded-xl bg-muted py-2 text-sm font-semibold transition active:scale-[.98]">Share profile</button>
        </div>
      </section>

      {shareOpen && profile && <ShareSheet myId={profile.id} name={profile.display_name || "Me"} onClose={() => setShareOpen(false)} />}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) changePhoto(f); e.target.value = ""; }} />
      {photoMenu && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 p-4" onClick={() => setPhotoMenu(false)}>
          <div className="keep-bubble-in w-full max-w-sm space-y-3 rounded-3xl bg-background p-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-fit">{avatarEl(64)}</div>
            <p className="font-display font-semibold">Profile photo</p>
            <div className="divide-y overflow-hidden rounded-2xl border text-sm font-semibold">
              <button onClick={pickPhoto} className="block w-full py-3 text-primary">{avatar ? "Upload new photo" : "Upload photo"}</button>
              {avatar && <button onClick={() => { removePhoto(); setPhotoMenu(false); }} className="block w-full py-3 text-destructive">Remove photo</button>}
              <button onClick={() => setPhotoMenu(false)} className="block w-full py-3">Cancel</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {editing && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
        <div className="keep-bubble-in flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-background">
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <button onClick={() => { setEditing(false); if (profile) { setName(profile.display_name); setBio(profile.bio); setUsername(profile.username); } }} className="text-sm">Cancel</button>
            <p className="font-display font-semibold">Edit profile</p>
            <button disabled={saving} onClick={async () => { setSaving(true); if (await save()) setEditing(false); setSaving(false); }} className="text-sm font-semibold text-brand-2 disabled:opacity-50">{saving ? "Saving…" : "Done"}</button>
          </div>
          <div className="w-full flex-1 overflow-y-auto p-5">
            <div className="flex flex-col items-center gap-2">
              {avatarEl(96)}
              <button type="button" onClick={() => setPhotoMenu(true)} className="text-sm font-semibold text-brand-2">Change profile photo</button>
            </div>
            <div className="mt-6 divide-y border-y">
              <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name" className="w-full bg-transparent py-3 outline-none" /></Field>
              <Field label="Username"><div className="flex items-center"><span className="text-muted-foreground">@</span><input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} maxLength={24} placeholder="username" autoCapitalize="none" className="w-full bg-transparent py-3 outline-none" /></div></Field>
              <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} placeholder="Bio" className="w-full resize-none bg-transparent py-3 outline-none" /><p className="pb-2 text-right text-xs text-muted-foreground">{bio.length}/200</p></Field>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Friends only see your photo, name, username, bio and streak.</p>
          </div>
        </div>
        </div>,
        document.body,
      )}

      <section className="space-y-2 rounded-2xl border p-5">
        <h2 className="flex items-center gap-2 font-semibold">Friend requests {requests.length > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{requests.length}</span>}</h2>
        {!requests.length && <p className="text-sm text-muted-foreground">No new requests.</p>}
        {requests.map((r) => (
          <ProfileRow key={r.id} p={r} action={
            <div className="flex gap-1">
              <button onClick={() => answer(r.id, true)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Accept</button>
              <button onClick={() => answer(r.id, false)} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Reject</button>
            </div>
          } />
        ))}
      </section>

      <section className="space-y-2 rounded-2xl border p-5">
        <h2 className="font-semibold">Who can see your plans</h2>
        <p className="text-xs text-muted-foreground">Only people you accept can see your plans. Memories always stay private.</p>
        {!shares.length && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
        {shares.map((s) => s.profile && (
          <ProfileRow key={s.viewer_id} p={s.profile} action={s.status === "pending" ? (
            <div className="flex gap-1">
              <button onClick={() => shareAct(() => approve(s.viewer_id))} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Accept</button>
              <button onClick={() => shareAct(() => removeShare(s.owner_id, s.viewer_id))} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Decline</button>
            </div>
          ) : (
            <button onClick={() => shareAct(() => removeShare(s.owner_id, s.viewer_id))} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Remove</button>
          )} />
        ))}
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
        <label className="flex items-center justify-between gap-4 border-t pt-3">
          <span className="text-sm"><b>Show when I'm typing</b><span className="block text-muted-foreground">Friends see typing dots while you write.</span></span>
          <input type="checkbox" role="switch" checked={typingOn} onChange={(e) => { setTypingOn(e.target.checked); localStorage.setItem("keep-typing", e.target.checked ? "on" : "off"); }} className="h-6 w-11 shrink-0 accent-primary" />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] items-start gap-3">
      <span className="pt-3 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
