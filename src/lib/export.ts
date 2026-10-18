import { supabase } from "@/integrations/supabase/client";

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join(" ") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export async function buildExport(format: "json" | "csv") {
  const [{ data: tasks }, { data: memories }] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("memories").select("*"),
  ]);
  const paths = (memories ?? []).filter((m) => m.file_path).map((m) => m.file_path as string);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage.from("uploads").createSignedUrls(paths, 60 * 60 * 24 * 7);
    data?.forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }
  const mems = (memories ?? []).map((m) => ({ ...m, file_link: m.file_path ? urls[m.file_path] ?? "" : "" }));
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return new File([JSON.stringify({ exported_at: new Date().toISOString(), tasks, memories: mems }, null, 2)],
      `keep-backup-${stamp}.json`, { type: "application/json" });
  }
  const csv = `# TASKS\n${toCsv(tasks ?? [])}\n\n# MEMORIES\n${toCsv(mems)}`;
  return new File([csv], `keep-backup-${stamp}.csv`, { type: "text/csv;charset=utf-8" });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
