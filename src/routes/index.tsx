import { createFileRoute, Link } from "@tanstack/react-router";
import { ListChecks, Image as ImageIcon, Bell, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Keep — plan, remember, get reminded" },
      { name: "description", content: "Your minimal personal space for plans, memories, reminders and AI suggestions." },
      { property: "og:title", content: "Keep — plan, remember, get reminded" },
      { property: "og:description", content: "Your minimal personal space for plans, memories, reminders and AI suggestions." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ListChecks, title: "Plan", text: "Simple lists for today and beyond." },
  { icon: ImageIcon, title: "Remember", text: "A private feed of photos, files and notes." },
  { icon: Bell, title: "Remind", text: "Gentle nudges right on your device." },
  { icon: Sparkles, title: "Suggest", text: "AI ideas based on what matters to you." },
];

function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="ring-gradient">
        <img src="/icon-512.png" alt="" width={88} height={88} className="h-22 w-22 rounded-full border-4 border-background bg-background" />
      </div>
      <h1 className="mt-6 text-5xl font-bold md:text-6xl">
        <span className="text-gradient-brand">Keep</span>
      </h1>
      <p className="mt-3 max-w-sm text-center text-muted-foreground">
        Plan your days, keep your moments, never forget the little things.
      </p>
      <div className="mt-8 flex gap-3">
        <Link to="/auth" className="rounded-full bg-gradient-brand px-7 py-3 font-semibold text-primary-foreground shadow-lg transition hover:opacity-90">
          Get started
        </Link>
      </div>
      <div className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border p-5">
            <f.icon className="h-5 w-5" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
