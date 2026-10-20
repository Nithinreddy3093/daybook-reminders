import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", uid)
      .order("done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const memoriesQuery = queryOptions({
  queryKey: ["memories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const paths = data.filter((m) => m.file_path).map((m) => m.file_path as string);
    const urls: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("uploads").createSignedUrls(paths, 3600);
      signed?.forEach((s) => {
        if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
      });
    }
    return data.map((m) => ({ ...m, url: m.file_path ? urls[m.file_path] : undefined }));
  },
});

export function fmtWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export type Memory = Awaited<ReturnType<NonNullable<typeof memoriesQuery.queryFn>>>[number];
