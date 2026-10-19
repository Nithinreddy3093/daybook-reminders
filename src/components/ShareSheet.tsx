import { useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/lib/use-sheet";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getFollowList, getFollowing, initials, type PublicProfile } from "@/lib/social";
import { sendMessage } from "@/lib/messages";
import { tap } from "@/lib/haptics";

export function ShareSheet({ myId, name, onClose }: { myId: string; name: string; onClose: () => void }) {
  const url = `${window.location.origin}/u/${myId}`;
  useScrollLock(true);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const { data: people = [] } = useQuery({
    queryKey: ["share-people", myId],
    queryFn: async () => {
      const [a, b] = await Promise.all([getFollowing(), getFollowList(myId, "followers")]);
      const m = new Map<string, PublicProfile>();
      [...a, ...b].forEach((p) => m.set(p.id, p));
      return [...m.values()];
    },
  });
  const list = people.filter((p) => `${p.display_name ?? ""} ${p.username ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  const send = async (p: PublicProfile) => {
    tap();
    setSent((s) => new Set(s).add(p.id));
    try { await sendMessage(p.id, `Check out my Keep profile 👋 ${url}`); }
    catch { toast.error("Could not send"); setSent((s) => { const n = new Set(s); n.delete(p.id); return n; }); }
  };
  const copy = async () => { tap(); try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast.error("Could not copy"); } };
  const native = async () => {
    tap();
    if (navigator.share) { try { await navigator.share({ title: `${name} on Keep`, url }); } catch { /* cancelled */ } }
    else copy();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 md:items-center" onClick={onClose}>
      <div className="keep-bubble-in flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-background pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <p className="py-3 text-center font-display font-semibold">Share profile</p>
        <div className="px-4"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" className="w-full rounded-xl bg-muted px-3 py-2 text-base outline-none md:text-sm" /></div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {list.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No friends or followers yet</p> : list.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">{initials(p)}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.display_name || p.username}</p>{p.username && <p className="truncate text-xs text-muted-foreground">@{p.username}</p>}</div>
              <button onClick={() => send(p)} disabled={sent.has(p.id)} className={`rounded-lg px-4 py-1.5 text-xs font-semibold active:scale-95 ${sent.has(p.id) ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                {sent.has(p.id) ? <Check className="h-4 w-4" /> : "Send"}
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t px-4 pt-3">
          <button onClick={copy} className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs active:scale-95"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"><Copy className="h-5 w-5" /></span>Copy link</button>
          <button onClick={native} className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs active:scale-95"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">{typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="h-5 w-5" /> : <Send className="h-5 w-5" />}</span>Share to apps</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
