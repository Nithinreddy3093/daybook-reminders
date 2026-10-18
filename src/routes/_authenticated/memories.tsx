import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { memoriesQuery, fmtWhen } from "@/lib/data";

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

function MemoriesPage() {
  const { data: memories } = useSuspenseQuery(memoriesQuery);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

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
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCaption(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["memories"] });
  };

  const remove = async (id: string, path: string | null) => {
    if (path) await supabase.storage.from("uploads").remove([path]);
    await supabase.from("memories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["memories"] });
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Memories</h1>
      <form onSubmit={post} className="rounded-2xl border p-4">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Write a note or caption…"
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
            <Paperclip className="h-3.5 w-3.5" /> <span className="max-w-40 truncate">{file ? file.name : "Photo, video or any file"}</span>
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button disabled={busy} className="ml-auto rounded-full bg-gradient-brand px-5 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Saving…" : "Share"}
          </button>
        </div>
      </form>

      {memories.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nothing saved yet. Your first memory goes here.</p>
      ) : (
        <div className="space-y-6">
          {memories.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-2xl border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground">{fmtWhen(m.created_at)}</span>
                <button onClick={() => remove(m.id, m.file_path)} aria-label="Delete" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {m.url && m.file_type?.startsWith("image/") && (
                <img src={m.url} alt={m.caption ?? ""} loading="lazy" className="max-h-[600px] w-full bg-muted object-cover" />
              )}
              {m.url && m.file_type?.startsWith("video/") && <video src={m.url} controls className="w-full bg-muted" />}
              {m.url && m.file_type?.startsWith("audio/") && <audio src={m.url} controls className="w-full px-4" />}
              {m.url && !/^(image|video|audio)\//.test(m.file_type ?? "") && (
                <a href={m.url} target="_blank" rel="noreferrer" className="mx-4 flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
                  <FileText className="h-4 w-4" /> <span className="truncate">{m.file_name}</span>
                </a>
              )}
              {m.caption && <p className="whitespace-pre-wrap px-4 py-3 text-sm">{m.caption}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
