import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Grid3x3, Heart, Paperclip, Rows3, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { memoriesQuery, fmtWhen } from "@/lib/data";
import { suggestCaption } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/memories")({
  head: () => ({
    meta: [
      { title: "Memories — Keep" },
      { name: "description", content: "Your private feed of photos, files and notes." },
      { property: "og:title", content: "Memories — Keep" },
      { property: "og:description", content: "Your private feed of photos, files and notes." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(memoriesQuery),
  component: MemoriesPage,
});

type Memory = (typeof memoriesQuery extends { queryFn?: infer F } ? F extends (...a: never[]) => Promise<infer R> ? R : never : never) extends (infer M)[] ? M : never;
const FILTERS = ["All", "Photos", "Videos", "Notes", "Files", "Favorites"] as const;
const isImg = (m: Memory) => !!m.file_type?.startsWith("image/");

function MemoriesPage() {
  const { data: memories } = useSuspenseQuery(memoriesQuery);
  const qc = useQueryClient();
  const aiCaption = useServerFn(suggestCaption);
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [layout, setLayout] = useState<"feed" | "grid">("feed");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["memories"] });

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim() && !file) return;
    setBusy(true);
    let file_path: string | null = null;
    if (file) {
      const { data: u } = await supabase.auth.getUser();
      file_path = `${u.user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("uploads").upload(file_path, file, { contentType: file.type });
      if (error) { setBusy(false); toast.error(error.message); return; }
    }
    const { error } = await supabase.from("memories").insert({
      caption: caption.trim() || null, file_path, file_name: file?.name ?? null, file_type: file?.type || null,
      tags: tags.split(/[\s,#]+/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCaption(""); setTags(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
  };

  const suggest = async () => {
    setAiBusy(true);
    try {
      const r = await aiCaption({ data: { note: caption, fileName: file?.name } });
      if (r.caption) setCaption(r.caption);
      if (r.tags.length) setTags(r.tags.join(" "));
      if (!r.caption && !r.tags.length) toast.error("No suggestion right now");
    } catch { toast.error("No suggestion right now"); }
    setAiBusy(false);
  };

  const remove = async (id: string, path: string | null) => {
    if (path) await supabase.storage.from("uploads").remove([path]);
    await supabase.from("memories").delete().eq("id", id);
    setLightbox(null);
    refresh();
  };
  const fav = async (m: Memory) => {
    await supabase.from("memories").update({ favorite: !m.favorite }).eq("id", m.id);
    refresh();
  };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^#/, "");
    return memories
      .filter((m) => {
        if (filter === "Photos") return isImg(m);
        if (filter === "Videos") return m.file_type?.startsWith("video/");
        if (filter === "Notes") return !m.file_path;
        if (filter === "Files") return m.file_path && !/^(image|video)\//.test(m.file_type ?? "");
        if (filter === "Favorites") return m.favorite;
        return true;
      })
      .filter((m) => !s || [m.caption, m.file_name, ...(m.tags ?? [])].some((v) => v?.toLowerCase().includes(s)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }, [memories, q, filter]);

  const media = shown.filter((m) => m.url && /^(image|video)\//.test(m.file_type ?? ""));
  const openLb = (m: Memory) => setLightbox(media.findIndex((x) => x.id === m.id));

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Memories</h1>
        <div className="flex rounded-full border p-1">
          <button onClick={() => setLayout("feed")} aria-label="Feed view" className={`rounded-full p-1.5 ${layout === "feed" ? "bg-muted" : ""}`}><Rows3 className="h-4 w-4" /></button>
          <button onClick={() => setLayout("grid")} aria-label="Grid view" className={`rounded-full p-1.5 ${layout === "grid" ? "bg-muted" : ""}`}><Grid3x3 className="h-4 w-4" /></button>
        </div>
      </div>

      <form onSubmit={post} className="rounded-2xl border p-4">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Write a note or caption…"
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#tags (travel family food)"
          className="w-full bg-transparent text-xs text-muted-foreground outline-none" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
            <Paperclip className="h-3.5 w-3.5" /> <span className="max-w-32 truncate">{file ? file.name : "Add file"}</span>
          </button>
          <button type="button" onClick={suggest} disabled={aiBusy || (!caption.trim() && !file)} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5 text-brand-2" /> {aiBusy ? "Thinking…" : "AI caption"}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button disabled={busy} className="ml-auto rounded-full bg-gradient-brand px-5 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Saving…" : "Share"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions, files, #tags" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${filter === f ? "bg-foreground text-background" : "bg-muted"}`}>{f}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{memories.length ? "No matches." : "Nothing saved yet. Your first memory goes here."}</p>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-3 gap-1">
          {shown.map((m) => (
            <button key={m.id} onClick={() => (m.url && /^(image|video)\//.test(m.file_type ?? "") ? openLb(m) : setLayout("feed"))}
              className="relative aspect-square overflow-hidden rounded-md bg-muted">
              {isImg(m) && m.url ? <img src={m.url} alt={m.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />
                : m.file_type?.startsWith("video/") && m.url ? <video src={m.url} muted className="h-full w-full object-cover" />
                : <span className="line-clamp-4 p-2 text-left text-[11px]">{m.caption || m.file_name}</span>}
              {m.favorite && <Heart className="absolute right-1.5 top-1.5 h-4 w-4 fill-brand-2 text-brand-2" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {shown.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-2xl border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground">{fmtWhen(m.created_at)}</span>
                <button onClick={() => remove(m.id, m.file_path)} aria-label="Delete" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {m.url && isImg(m) && (
                <button onClick={() => openLb(m)} className="block w-full"><img src={m.url} alt={m.caption ?? ""} loading="lazy" className="max-h-[600px] w-full bg-muted object-cover" /></button>
              )}
              {m.url && m.file_type?.startsWith("video/") && <video src={m.url} controls className="w-full bg-muted" />}
              {m.url && m.file_type?.startsWith("audio/") && <audio src={m.url} controls className="w-full px-4" />}
              {m.url && !/^(image|video|audio)\//.test(m.file_type ?? "") && (
                <a href={m.url} target="_blank" rel="noreferrer" className="mx-4 flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
                  <FileText className="h-4 w-4" /> <span className="truncate">{m.file_name}</span>
                </a>
              )}
              <div className="px-4 pt-3">
                <button onClick={() => fav(m)} aria-label={m.favorite ? "Unfavorite" : "Favorite"}>
                  <Heart className={`h-6 w-6 transition ${m.favorite ? "fill-brand-2 text-brand-2" : ""}`} />
                </button>
              </div>
              {m.caption && <p className="whitespace-pre-wrap px-4 pt-1 text-sm">{m.caption}</p>}
              {m.tags?.length > 0 && (
                <p className="flex flex-wrap gap-2 px-4 pt-1 text-sm">
                  {m.tags.map((t) => <button key={t} onClick={() => setQ(t)} className="text-brand-3">#{t}</button>)}
                </p>
              )}
              <div className="h-3" />
            </article>
          ))}
        </div>
      )}

      {lightbox !== null && media[lightbox] && (
        <Lightbox items={media} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} onFav={fav} />
      )}
    </div>
  );
}

function Lightbox({ items, index, onIndex, onClose, onFav }: {
  items: Memory[]; index: number; onIndex: (i: number) => void; onClose: () => void; onFav: (m: Memory) => void;
}) {
  const m = items[index];
  const touch = useRef<number | null>(null);
  const prev = () => onIndex((index - 1 + items.length) % items.length);
  const next = () => onIndex((index + 1) % items.length);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next(); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  });

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex flex-col bg-foreground/95 text-background backdrop-blur"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) (dx > 0 ? prev() : next()); touch.current = null; }}>
      <div className="flex gap-1 px-3 pt-3">
        {items.map((x, i) => <span key={x.id} className={`h-0.5 flex-1 rounded-full ${i <= index ? "bg-background" : "bg-background/30"}`} />)}
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs opacity-80">{fmtWhen(m.created_at)}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => onFav(m)} aria-label="Favorite" className="rounded-full p-2"><Heart className={`h-5 w-5 ${m.favorite ? "fill-brand-2 text-brand-2" : ""}`} /></button>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2"><X className="h-6 w-6" /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {m.file_type?.startsWith("video/") ? <video key={m.id} src={m.url} controls autoPlay className="max-h-full max-w-full" />
          : <img src={m.url} alt={m.caption ?? ""} className="max-h-full max-w-full object-contain" />}
        {items.length > 1 && <>
          <button onClick={prev} aria-label="Previous" className="absolute left-2 hidden rounded-full bg-background/20 p-2 md:block"><ChevronLeft className="h-6 w-6" /></button>
          <button onClick={next} aria-label="Next" className="absolute right-2 hidden rounded-full bg-background/20 p-2 md:block"><ChevronRight className="h-6 w-6" /></button>
        </>}
      </div>
      {(m.caption || m.tags?.length > 0) && (
        <p className="px-5 py-4 text-sm">{m.caption} {m.tags?.map((t) => <span key={t} className="opacity-70"> #{t}</span>)}</p>
      )}
    </div>
  );
}
