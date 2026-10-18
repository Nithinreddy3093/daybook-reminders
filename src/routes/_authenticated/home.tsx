import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { tasksQuery, memoriesQuery, fmtWhen } from "@/lib/data";
import { AiSuggest } from "@/components/AiSuggest";
import { QuickAdd } from "@/components/QuickAdd";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Keep" },
      { name: "description", content: "Your day at a glance." },
      { property: "og:title", content: "Home — Keep" },
      { property: "og:description", content: "Your day at a glance." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(tasksQuery), context.queryClient.ensureQueryData(memoriesQuery)]),
  component: HomePage,
});

function HomePage() {
  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const { data: memories } = useSuspenseQuery(memoriesQuery);
  const open = tasks.filter((t) => !t.done);
  const doneCount = tasks.length - open.length;
  const next = open
    .filter((t) => t.remind_at && new Date(t.remind_at).getTime() > Date.now())
    .sort((a, b) => +new Date(a.remind_at!) - +new Date(b.remind_at!))[0];
  const pics = memories.filter((m) => m.file_type?.startsWith("image/")).slice(0, 6);
  const weekAgo = Date.now() - 7 * 864e5;
  const doneWeek = tasks.filter((t) => t.done && +new Date(t.created_at) > weekAgo).length;
  const momentsWeek = memories.filter((m) => +new Date(m.created_at) > weekAgo).length;
  const dayKeys = new Set(memories.map((m) => new Date(m.created_at).toDateString()));
  let streak = 0;
  for (let d = new Date(); dayKeys.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{greet}</h1>
      <QuickAdd />
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/plans" className="rounded-2xl border p-5 transition hover:bg-muted">
          <CheckCircle2 className="h-5 w-5" />
          <p className="mt-4 text-4xl font-bold font-display">{open.length}</p>
          <p className="text-sm text-muted-foreground">open tasks · {doneCount} done</p>
        </Link>
        <Link to="/plans" className="rounded-2xl bg-gradient-brand p-5 text-primary-foreground transition hover:opacity-95">
          <Bell className="h-5 w-5" />
          <p className="mt-4 text-lg font-semibold leading-snug">{next ? next.title : "No upcoming reminders"}</p>
          <p className="text-sm opacity-90">{next ? fmtWhen(next.remind_at) : "Add one in Plans"}</p>
        </Link>
        <Link to="/memories" className="rounded-2xl border p-5 transition hover:bg-muted">
          <ImageIcon className="h-5 w-5" />
          <p className="mt-4 text-4xl font-bold font-display">{memories.length}</p>
          <p className="text-sm text-muted-foreground">memories saved</p>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[[doneWeek, "done this week"], [momentsWeek, "moments this week"], [streak, "day memory streak 🔥"]].map(([n, l]) => (
          <div key={String(l)} className="rounded-2xl bg-muted p-4">
            <p className="font-display text-2xl font-bold">{n}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <AiSuggest />

      <section>
        <h2 className="mb-3 font-semibold">Today's focus</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear. Enjoy your day ✨</p>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {open.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{t.title}</span>
                <span className="text-xs text-muted-foreground">{fmtWhen(t.due_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pics.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Recent memories</h2>
          <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
            {pics.map((m) => (
              <img key={m.id} src={m.url} alt={m.caption ?? ""} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
