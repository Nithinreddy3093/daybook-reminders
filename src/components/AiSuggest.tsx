import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSuggestions } from "@/lib/ai.functions";

const chips = ["Plan my week", "What should I do today?", "Ideas for the weekend", "Help me get healthier"];

export function AiSuggest() {
  const run = useServerFn(getSuggestions);
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<{ text: string; task: boolean }[]>([]);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (p = prompt) => {
    setBusy(true); setErr(""); setAdded(new Set());
    try {
      const r = await run({ data: { prompt: p } });
      if (r.error) setErr("Couldn't get suggestions right now. Try again in a moment.");
      setItems(r.items);
    } catch {
      setErr("Couldn't get suggestions right now. Try again in a moment.");
    }
    setBusy(false);
  };

  const addTask = async (i: number, text: string) => {
    const { error } = await supabase.from("tasks").insert({ title: text });
    if (error) { toast.error(error.message); return; }
    setAdded((s) => new Set(s).add(i));
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Added to Plans");
  };

  return (
    <div className="ring-gradient rounded-2xl!">
      <div className="rounded-[calc(1rem-2px)] bg-background p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-brand-2" /> AI suggestions
        </div>
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="mt-3 flex gap-2">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask anything, e.g. plan my weekend"
            className="min-w-0 flex-1 rounded-full border bg-muted px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button disabled={busy} className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "…" : "Suggest"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c} disabled={busy} onClick={() => { setPrompt(c); go(c); }} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">{c}</button>
          ))}
        </div>
        {err && <p className="mt-4 text-sm text-muted-foreground">{err}</p>}
        {items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <span className="flex-1">{it.text}</span>
                {it.task && (
                  <button onClick={() => addTask(i, it.text)} disabled={added.has(i)} aria-label="Add to Plans"
                    className="flex shrink-0 items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs font-medium shadow-sm disabled:opacity-60">
                    {added.has(i) ? <><Check className="h-3.5 w-3.5" /> Added</> : <><Plus className="h-3.5 w-3.5" /> Plans</>}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
