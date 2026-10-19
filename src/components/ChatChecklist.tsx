import { useRef, useState } from "react";
import { Check, ListChecks, Plus } from "lucide-react";
import { tap } from "@/lib/haptics";

export type ChecklistItem = { id: string; text: string; done: boolean; by: string | null };

/** Shared checklist bubble: swipe right (or tap the circle) to check an item off. */
export function ChatChecklist({ title, items, onToggle, onAdd, pending }: {
  title: string; items: ChecklistItem[]; pending?: boolean;
  onToggle: (itemId: string) => void; onAdd: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const done = items.filter((i) => i.done).length;
  return (
    <div className={`w-72 max-w-full overflow-hidden rounded-3xl border bg-background ${pending ? "opacity-70" : ""}`} onDoubleClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground">
        <span className="flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{title}</span>
        <span>{done}/{items.length}</span>
      </div>
      <div className="h-1 bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>
      <ul className="divide-y">
        {items.map((it) => <Row key={it.id} item={it} onToggle={() => onToggle(it.id)} />)}
      </ul>
      {!pending && (
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onAdd(text); setText(""); } }} className="flex items-center gap-2 border-t px-3 py-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Add item" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <button type="submit" aria-label="Add item" disabled={!text.trim()} className="rounded-full p-1 text-primary disabled:opacity-30"><Plus className="h-4 w-4" /></button>
        </form>
      )}
    </div>
  );
}

function Row({ item, onToggle }: { item: ChecklistItem; onToggle: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const end = () => {
    if (dx > 70) { tap([10, 30, 10]); onToggle(); }
    start.current = null; setDx(0);
  };
  return (
    <li className="relative overflow-hidden">
      <div className="absolute inset-0 flex items-center bg-primary pl-4 text-primary-foreground" style={{ opacity: Math.min(dx / 70, 1) }}><Check className="h-4 w-4" /></div>
      <div
        className="relative flex select-none items-center gap-3 bg-background px-4 py-2.5 text-sm"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? "none" : "transform .35s cubic-bezier(.2,.9,.3,1.3)", touchAction: "pan-y" }}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, active: false }; }}
        onPointerMove={(e) => {
          const s = start.current; if (!s) return;
          const x = e.clientX - s.x, y = e.clientY - s.y;
          if (!s.active && Math.abs(y) > Math.abs(x)) { start.current = null; return; }
          if (x > 6) { s.active = true; setDx(Math.min(x, 120)); }
        }}
        onPointerUp={end} onPointerCancel={() => { start.current = null; setDx(0); }}
      >
        <button type="button" onClick={() => { tap(); onToggle(); }} aria-label={item.done ? "Uncheck" : "Check"}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${item.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
          {item.done && <Check className="h-3 w-3" />}
        </button>
        <span className={`flex-1 break-words transition ${item.done ? "text-muted-foreground line-through" : ""}`}>{item.text}</span>
      </div>
    </li>
  );
}
