import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { getSuggestions } from "@/lib/ai.functions";

export function AiSuggest() {
  const run = useServerFn(getSuggestions);
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const r = await run({ data: { prompt } });
      setText(r.error ? "Couldn't get suggestions right now. Try again in a moment." : r.text);
    } catch {
      setText("Couldn't get suggestions right now. Try again in a moment.");
    }
    setBusy(false);
  };

  return (
    <div className="ring-gradient rounded-2xl!">
      <div className="rounded-[calc(1rem-2px)] bg-background p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-brand-2" /> AI suggestions
        </div>
        <form onSubmit={go} className="mt-3 flex gap-2">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask anything, e.g. plan my weekend"
            className="min-w-0 flex-1 rounded-full border bg-muted px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button disabled={busy} className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "…" : "Suggest"}
          </button>
        </form>
        {text && (
          <div className="mt-4 space-y-1.5 text-sm leading-relaxed">
            {text.split("\n").filter(Boolean).map((l, i) => (
              <p key={i}>{l.replace(/^[-*]\s*/, "• ").replace(/\*\*/g, "")}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
