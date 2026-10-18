import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Sun, Moon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBriefing } from "@/lib/ai.functions";
import type { Task } from "@/lib/tasks";

export function DailyBriefing({ tasks }: { tasks: Task[] }) {
  const hour = new Date().getHours();
  const evening = hour >= 17 || hour < 5;
  const fn = useServerFn(getBriefing);
  const qc = useQueryClient();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toDateString();
  const doneToday = tasks.filter((t) => t.done && new Date(t.due_at ?? t.created_at).toDateString() === today);
  const dueToday = tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at).toDateString() === today);
  const high = tasks.filter((t) => !t.done && t.priority === "high");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fn({ data: { mode: evening ? "evening" : "morning", now: new Date().toString() } });
      if (r.error) toast.error(r.error);
      setText(r.text);
    } finally { setLoading(false); }
  };

  const saveHighlight = async () => {
    if (!note.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("memories").insert({ caption: note.trim(), tags: ["highlight"] });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNote("");
    toast("Saved to Memories ✨");
    qc.invalidateQueries({ queryKey: ["memories"] });
  };

  return (
    <section className="rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        {evening ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        <h2 className="font-semibold">{evening ? "Evening reflection" : "Morning briefing"}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {evening
          ? `You finished ${doneToday.length} task${doneToday.length === 1 ? "" : "s"} today.`
          : `${dueToday.length} due today · ${high.length} high priority`}
      </p>
      {text ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{text}</p>
      ) : (
        <button onClick={load} disabled={loading}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {evening ? "Reflect with AI" : "Get my briefing"}
        </button>
      )}
      {evening && (
        <div className="mt-4 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was your highlight today?"
            className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={saveHighlight} disabled={saving || !note.trim()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Save</button>
        </div>
      )}
    </section>
  );
}
