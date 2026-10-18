import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Keep" },
      { name: "description", content: "Sign in or create your Keep account." },
      { property: "og:title", content: "Sign in — Keep" },
      { property: "og:description", content: "Sign in or create your Keep account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && navigate({ to: "/home" }));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/home" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/home" },
      });
      if (error) toast.error(error.message);
      else if (!data.session) toast.success("Check your email to confirm your account");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setBusy(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in failed");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border px-8 py-10">
          <h1 className="text-center text-4xl font-bold text-gradient-brand">Keep</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {mode === "in" ? "Welcome back" : "Create your private space"}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-2">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border bg-muted px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border bg-muted px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button disabled={busy} className="mt-2 w-full rounded-lg bg-gradient-brand py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {mode === "in" ? "Log in" : "Sign up"}
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>
          <button onClick={google} className="w-full rounded-lg border py-2.5 text-sm font-semibold hover:bg-muted">
            Continue with Google
          </button>
        </div>
        <div className="mt-3 rounded-2xl border py-5 text-center text-sm">
          {mode === "in" ? "Don't have an account? " : "Have an account? "}
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-semibold text-brand-2">
            {mode === "in" ? "Sign up" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}
