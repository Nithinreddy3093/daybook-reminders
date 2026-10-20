import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { USERNAME_RE, normalizeUsername, usernameAvailable } from "@/lib/friends";

/** First-time setup: pick a unique @username, checked live like Instagram. */
export function UsernameGate() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-username"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("username, display_name").eq("id", u.user.id).maybeSingle();
      return { id: u.user.id, email: u.user.email ?? "", username: p?.username ?? null, display_name: p?.display_name ?? "" };
    },
    staleTime: Infinity,
  });
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !data.username && !name) setName(normalizeUsername((data.email.split("@")[0] || "").replace(/[^a-z0-9._]/gi, "")).slice(0, 30));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const n = normalizeUsername(name);
    if (!n) return setState("idle");
    if (!USERNAME_RE.test(n)) return setState("invalid");
    setState("checking");
    const t = setTimeout(() => usernameAvailable(n).then((ok) => setState(ok ? "ok" : "taken")).catch(() => setState("idle")), 350);
    return () => clearTimeout(t);
  }, [name]);

  if (!data || data.username) return null;

  const save = async () => {
    if (state !== "ok") return;
    setSaving(true);
    const n = normalizeUsername(name);
    const { error } = await supabase.from("profiles").upsert({ id: data.id, username: n, display_name: data.display_name || n, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { setState(error.code === "23505" ? "taken" : "idle"); return; }
    qc.setQueryData(["my-username"], { ...data, username: n });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const msg = { idle: "", checking: "Checking…", ok: "Available", taken: "This username isn't available.", invalid: "3–30 characters: letters, numbers, . and _ only." }[state];
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background p-6">
      <div className="keep-bubble-in w-full max-w-sm space-y-5 text-center">
        <img src="/icon-512.png" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
        <div>
          <h1 className="font-display text-2xl font-bold">Create a username</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick a username for your account. You can change it later.</p>
        </div>
        <div className={`flex items-center rounded-xl border bg-muted/40 px-3 ${state === "taken" || state === "invalid" ? "border-destructive" : ""}`}>
          <span className="text-muted-foreground">@</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, ""))} maxLength={30}
            autoCapitalize="none" autoCorrect="off" placeholder="username" onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-full bg-transparent px-1 py-3 text-base outline-none" />
          {state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {state === "ok" && <Check className="h-5 w-5 text-primary" />}
          {(state === "taken" || state === "invalid") && <X className="h-5 w-5 text-destructive" />}
        </div>
        <p className={`-mt-3 min-h-4 text-left text-xs ${state === "ok" ? "text-muted-foreground" : "text-destructive"}`}>{msg}</p>
        <button onClick={save} disabled={state !== "ok" || saving}
          className="w-full rounded-xl bg-gradient-brand py-3 font-semibold text-primary-foreground disabled:opacity-40">
          {saving ? "Saving…" : "Next"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
