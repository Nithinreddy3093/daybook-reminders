import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tasksQuery, fmtWhen } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Plans — Keep" },
      { name: "description", content: "Your tasks, plans and reminders." },
      { property: "og:title", content: "Plans — Keep" },
      { property: "og:description", content: "Your tasks, plans and reminders." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tasksQuery),
  component: PlansPage,
});

function PlansPage() {
  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [remind, setRemind] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      remind_at: remind ? new Date(remind).toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    setTitle(""); setDue(""); setRemind("");
    refresh();
  };
  const toggle = async (id: string, done: boolean) => {
    await supabase.from("tasks").update({ done: !done }).eq("id", id);
    refresh();
  };
  const remove = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Plans</h1>
      <form onSubmit={add} className="space-y-3 rounded-2xl border p-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to do?"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            Due <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <Bell className="h-3.5 w-3.5" /> <input type="datetime-local" value={remind} onChange={(e) => setRemind(e.target.value)} className="bg-transparent outline-none" />
          </label>
          <button className="ml-auto flex items-center gap-1 rounded-full bg-gradient-brand px-4 py-1.5 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </form>

      {tasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No plans yet. Add your first one above.</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {tasks.map((t) => (
            <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggle(t.id, t.done)} aria-label="Toggle done"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${t.done ? "border-transparent bg-gradient-brand text-primary-foreground" : ""}`}>
                {t.done && <Check className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                <p className="flex gap-3 text-xs text-muted-foreground">
                  {t.due_at && <span>Due {fmtWhen(t.due_at)}</span>}
                  {t.remind_at && <span className="flex items-center gap-1"><Bell className="h-3 w-3" />{fmtWhen(t.remind_at)}</span>}
                </p>
              </div>
              <button onClick={() => remove(t.id)} aria-label="Delete" className="rounded-full p-2 text-muted-foreground hover:bg-muted md:opacity-0 md:group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
