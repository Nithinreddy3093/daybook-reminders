import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseTask } from "@/lib/ai.functions";
import { fmtWhen } from "@/lib/data";

/** Natural-language task entry: "Gym tomorrow 7am every week" → structured task. */
export function QuickAdd({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const run = useServerFn(parseTask);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await run({ data: { text, now: new Date().toString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      const task = r.task ?? { title: text.trim(), due_at: null, remind_at: null, priority: "normal" as const, category: null, recurrence: "none" as const };
      const { error } = await supabase.from("tasks").insert(task);
      if (error) throw error;
      toast.success(`Added “${task.title}”`, { description: [task.due_at && `Due ${fmtWhen(task.due_at)}`, task.recurrence !== "none" && `Repeats ${task.recurrence}`].filter(Boolean).join(" · ") || undefined });
      setText("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onDone?.();
    } catch {
      toast.error("Couldn't add that. Try again.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-full border bg-muted/50 py-1.5 pl-4 pr-1.5">
      <Sparkles className="h-4 w-4 shrink-0 text-brand-2" />
      <input autoFocus={autoFocus} value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
        placeholder="Type naturally: “Call mom Friday 6pm”"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      <button disabled={busy} className="rounded-full bg-gradient-brand px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "…" : "Add"}
      </button>
    </form>
  );
}
