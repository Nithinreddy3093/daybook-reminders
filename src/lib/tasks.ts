import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export const PRIORITIES = ["high", "medium", "normal"] as const;
export const CATEGORIES = ["Personal", "Work", "Health", "Ideas", "Errands"] as const;
export const RECURRENCES = ["none", "daily", "weekly", "monthly"] as const;

export function nextOccurrence(iso: string | null, rec: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (rec === "daily") d.setDate(d.getDate() + 1);
  else if (rec === "weekly") d.setDate(d.getDate() + 7);
  else if (rec === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString();
}

/** Toggle done; completing a recurring task schedules its next occurrence. */
export async function toggleTask(t: Task) {
  const { data, error } = await supabase.from("tasks").update({ done: !t.done }).eq("id", t.id).select("id");
  if (error || !data?.length) throw new Error("Couldn't update this task");
  if (!t.done && t.recurrence !== "none") {
    await supabase.from("tasks").insert({
      title: t.title, notes: t.notes, priority: t.priority, category: t.category, recurrence: t.recurrence,
      due_at: nextOccurrence(t.due_at, t.recurrence) ?? nextOccurrence(new Date().toISOString(), t.recurrence),
      remind_at: nextOccurrence(t.remind_at, t.recurrence),
    });
  }
}

export const priorityStyle: Record<string, string> = {
  high: "bg-brand-3/15 text-brand-3",
  medium: "bg-brand/15 text-brand",
  normal: "bg-muted text-muted-foreground",
};
