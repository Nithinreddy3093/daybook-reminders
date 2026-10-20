import { createPortal } from "react-dom";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Plus, Trash2, Check, Repeat, List, CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, X } from "lucide-react";
import { tap } from "@/lib/haptics";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tasksQuery, fmtWhen } from "@/lib/data";
import { CATEGORIES, PRIORITIES, RECURRENCES, priorityStyle, toggleTask, type Task } from "@/lib/tasks";
import { QuickAdd } from "@/components/QuickAdd";

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

const FILTERS = ["All", "Today", "Upcoming", "Done"] as const;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function PlansPage() {
  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [remind, setRemind] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [category, setCategory] = useState("");
  const [recurrence, setRecurrence] = useState<string>("none");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [view, setView] = useState<"list" | "week">("list");
  const [cat, setCat] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), priority, recurrence, category: category || null,
      due_at: due ? new Date(due).toISOString() : null,
      remind_at: remind ? new Date(remind).toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    setTitle(""); setDue(""); setRemind(""); setPriority("normal"); setCategory(""); setRecurrence("none");
    refresh();
  };
  const toggle = async (t: Task) => {
    qc.setQueryData<Task[]>(["tasks"], (old) => old?.map((x) => x.id === t.id ? { ...x, done: !t.done } : x));
    try { await toggleTask(t); } catch { toast.error("Couldn't update this task"); }
    refresh();
  };
  const remove = async (id: string) => {
    const t = tasks.find((x) => x.id === id);
    tap(10);
    qc.setQueryData<Task[]>(["tasks"], (old) => old?.filter((x) => x.id !== id));
    const { data: gone, error } = await supabase.from("tasks").delete().eq("id", id).select("id");
    if (error || !gone?.length) { toast.error("Couldn't delete this task"); refresh(); return; }
    toast("Task deleted", {
      id: "task-deleted",
      action: t ? { label: "Undo", onClick: async () => {
        const { id: _i, created_at: _c, ...rest } = t as Task & { created_at: string };
        await supabase.from("tasks").insert({ ...rest, push_sent_for: null } as never); refresh();
      } } : undefined,
    });
    refresh();
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const rank = { high: 0, medium: 1, normal: 2 } as Record<string, number>;
    return tasks
      .filter((t) => !cat || t.category === cat)
      .filter((t) => {
        if (filter === "Done") return t.done;
        if (filter === "Today") return !t.done && t.due_at && sameDay(new Date(t.due_at), now);
        if (filter === "Upcoming") return !t.done && t.due_at && new Date(t.due_at) > now;
        return true;
      })
      .sort((a, b) => Number(a.done) - Number(b.done) || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2));
  }, [tasks, filter, cat]);

  const usedCats = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Plans</h1>
        <div className="flex rounded-full border p-1">
          <button onClick={() => setView("list")} aria-label="List view" className={`rounded-full p-1.5 ${view === "list" ? "bg-muted" : ""}`}><List className="h-4 w-4" /></button>
          <button onClick={() => setView("week")} aria-label="Week view" className={`rounded-full p-1.5 ${view === "week" ? "bg-muted" : ""}`}><CalendarDays className="h-4 w-4" /></button>
        </div>
      </div>

      <QuickAdd />
      <button onClick={() => setShowForm((s) => !s)} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline">
        {showForm ? "Hide detailed form" : "Or add with details"}
      </button>

      {showForm && (
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
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-full bg-muted px-3 py-1.5 capitalize outline-none">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p} priority</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-full bg-muted px-3 py-1.5 outline-none">
              <option value="">No category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="rounded-full bg-muted px-3 py-1.5 capitalize outline-none">
              {RECURRENCES.map((r) => <option key={r} value={r}>{r === "none" ? "Doesn't repeat" : r}</option>)}
            </select>
            <button className="ml-auto flex items-center gap-1 rounded-full bg-gradient-brand px-4 py-1.5 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </form>
      )}

      {view === "list" ? (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${filter === f ? "bg-foreground text-background" : "bg-muted"}`}>{f}</button>
            ))}
            {usedCats.map((c) => (
              <button key={c} onClick={() => setCat(cat === c ? "" : c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${cat === c ? "border-foreground" : ""}`}>#{c}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {filtered.map((t) => <TaskRow key={t.id} t={t} onToggle={toggle} onRemove={remove} onChanged={refresh} />)}
            </ul>
          )}
        </>
      ) : (
        <WeekView tasks={tasks} onToggle={toggle} onRemove={remove} />
      )}
    </div>
  );
}

function TaskRow({ t, onToggle, onRemove, onChanged }: { t: Task; onToggle: (t: Task) => void; onRemove: (id: string) => void; onChanged: () => void }) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(t.title);
  const start = useRef<{ x: number; y: number; base: number; lock?: "h" | "v" } | null>(null);
  const OPEN = -216;

  const down = (e: React.PointerEvent) => { if (editing) return; start.current = { x: e.clientX, y: e.clientY, base: open ? OPEN : 0 }; };
  const move = (e: React.PointerEvent) => {
    const s = start.current; if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.lock) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; s.lock = Math.abs(mx) > Math.abs(my) ? "h" : "v"; if (s.lock === "h") { setDrag(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } }
    if (s.lock !== "h") return;
    let v = s.base + mx;
    if (v > 120) v = 120 + (v - 120) * 0.3;
    if (v < -200) v = -200 + (v + 200) * 0.3;
    setDx(v);
  };
  const up = () => {
    const s = start.current; start.current = null;
    if (!s || s.lock !== "h") return;
    setDrag(false);
    if (dx > 80) { tap(15); setDx(0); setOpen(false); onToggle(t); return; }
    if (dx < -60) { tap(); setDx(OPEN); setOpen(true); } else { setDx(0); setOpen(false); }
  };
  const close = () => { setDx(0); setOpen(false); };
  const snooze = async () => {
    const base = Math.max(Date.now(), t.remind_at ? new Date(t.remind_at).getTime() : 0);
    const when = new Date(base + 60 * 60 * 1000).toISOString();
    close();
    const { error } = await supabase.from("tasks").update({ remind_at: when, push_sent_for: null }).eq("id", t.id);
    if (error) toast.error(error.message); else { toast("Snoozed 1 hour"); onChanged(); }
  };
  const saveEdit = async () => {
    setEditing(false);
    const v = text.trim(); if (!v || v === t.title) { setText(t.title); return; }
    const { error } = await supabase.from("tasks").update({ title: v }).eq("id", t.id);
    if (error) toast.error(error.message); else onChanged();
  };

  return (
    <li className="relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-between">
        <div className={`flex h-full items-center bg-gradient-brand px-5 text-primary-foreground transition-opacity ${dx > 0 ? "opacity-100" : "opacity-0"}`} style={{ width: Math.max(dx, 0) + 40 }}>
          <Check className={`h-5 w-5 transition-transform ${dx > 80 ? "scale-125" : ""}`} />
        </div>
        <div className={`flex h-full ${dx < 0 ? "opacity-100" : "opacity-0"}`}>
          <button onClick={snooze} className="flex w-[72px] flex-col items-center justify-center gap-0.5 bg-accent text-[11px] font-semibold"><Clock className="h-4 w-4" />Snooze</button>
          <button onClick={() => { close(); setEditing(true); }} className="flex w-[72px] flex-col items-center justify-center gap-0.5 bg-foreground text-[11px] font-semibold text-background"><Pencil className="h-4 w-4" />Edit</button>
          <button onClick={() => { close(); onRemove(t.id); }} className="flex w-[72px] flex-col items-center justify-center gap-0.5 bg-destructive text-[11px] font-semibold text-destructive-foreground"><Trash2 className="h-4 w-4" />Delete</button>
        </div>
      </div>
      <div
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ transform: `translate3d(${dx}px,0,0)`, transition: drag ? "none" : "transform .45s cubic-bezier(.2,1.4,.4,1)", touchAction: "pan-y" }}
        className="group relative flex items-center gap-3 bg-background px-4 py-3">
        <button onClick={() => onToggle(t)} aria-label="Toggle done"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${t.done ? "border-transparent bg-gradient-brand text-primary-foreground" : ""}`}>
          {t.done && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1" onClick={() => open && close()}>
          {editing ? (
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") { setText(t.title); setEditing(false); } }}
              className="w-full rounded-md bg-muted px-2 py-1 text-base outline-none md:text-sm" />
          ) : (
            <p className={`truncate text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {t.priority !== "normal" && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityStyle[t.priority]}`}>{t.priority}</span>}
            {t.category && <span>#{t.category}</span>}
            {t.due_at && <span>Due {fmtWhen(t.due_at)}</span>}
            {t.remind_at && <span className="flex items-center gap-1"><Bell className="h-3 w-3" />{fmtWhen(t.remind_at)}</span>}
            {t.recurrence !== "none" && <span className="flex items-center gap-1 capitalize"><Repeat className="h-3 w-3" />{t.recurrence}</span>}
          </p>
        </div>
        <button onClick={() => onRemove(t.id)} aria-label="Delete" className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-90">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function WeekView({ tasks, onToggle, onRemove }: { tasks: Task[]; onToggle: (t: Task) => void; onRemove: (id: string) => void }) {
  const [offset, setOffset] = useState(0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const today = new Date();
  const [openDay, setOpenDay] = useState<Date | null>(null);
  useEffect(() => {
    if (!openDay) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpenDay(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [openDay]);
  const dayList = openDay ? tasks.filter((t) => t.due_at && sameDay(new Date(t.due_at), openDay)).sort((a, b) => a.due_at!.localeCompare(b.due_at!)) : [];

  return (
    <div className="space-y-3">
      {openDay && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" onClick={() => setOpenDay(null)}>
          <div className="keep-bubble-in flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-background" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              <p className="font-display font-semibold">{openDay.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
              <button onClick={() => setOpenDay(null)} aria-label="Close" className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {!dayList.length && <p className="py-6 text-center text-sm text-muted-foreground">Nothing planned.</p>}
              {dayList.map((t) => (
                <div key={t.id} className="flex w-full items-center gap-2 rounded-2xl border p-2 pl-3">
                  <button onClick={() => onToggle(t)} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${t.done ? "bg-primary text-primary-foreground" : ""}`}>{t.done && <Check className="h-3 w-3" />}</span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-muted-foreground line-through" : "font-medium"}`}>{t.title}</span>
                    <span className="text-xs text-muted-foreground">{new Date(t.due_at!).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  </button>
                  <button onClick={() => onRemove(t.id)} aria-label="Delete" className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-90"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset(offset - 1)} aria-label="Previous week" className="rounded-full p-2 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-semibold">
          {days[0]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[6]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
        <button onClick={() => setOffset(offset + 1)} aria-label="Next week" className="rounded-full p-2 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const list = tasks.filter((t) => t.due_at && sameDay(new Date(t.due_at), d));
          const isToday = sameDay(d, today);
          return (
            <div key={d.toISOString()} onClick={() => setOpenDay(d)} className={`min-h-24 cursor-pointer rounded-2xl border p-2 transition active:scale-[0.98] ${isToday ? "ring-2 ring-brand-2" : ""}`}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {d.toLocaleDateString(undefined, { weekday: "short" })} <span className={isToday ? "text-foreground" : ""}>{d.getDate()}</span>
              </p>
              <div className="space-y-1">
                {list.slice(0, 3).map((t) => (
                  <button key={t.id} onClick={(e) => { e.stopPropagation(); onToggle(t); }}
                    className={`block w-full truncate rounded-lg px-2 py-1 text-left text-xs ${t.done ? "bg-muted text-muted-foreground line-through" : priorityStyle[t.priority] + " font-medium"}`}>
                    {new Date(t.due_at!).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} {t.title}
                  </button>
                ))}
                {list.length > 3 && <p className="px-2 text-xs font-semibold text-muted-foreground">+{list.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Tap a day to see everything planned. Tap a task to mark it done. Tasks without a due date show in list view.</p>
    </div>
  );
}
