import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

async function ask(instructions: string, input: string) {
  const res = await generateResponse({ model: "openai/gpt-6-astra", instructions, input });
  return res.output
    .flatMap((o) => (o.type === "message" ? o.content : []))
    .map((c) => (c.type === "output_text" ? c.text : ""))
    .join("");
}

function extractJson(text: string): unknown {
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export const getSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt?: string }) => ({ prompt: (input.prompt ?? "").slice(0, 500) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: tasks }, { data: memories }] = await Promise.all([
      supabase.from("tasks").select("title, done, due_at, priority, category").order("created_at", { ascending: false }).limit(30),
      supabase.from("memories").select("caption, tags, created_at").order("created_at", { ascending: false }).limit(15),
    ]);
    const ctx = `Tasks: ${JSON.stringify(tasks ?? [])}\nMemories: ${JSON.stringify(memories ?? [])}\nNow: ${new Date().toISOString()}`;
    try {
      const text = await ask(
        "You are a warm, concise personal planning assistant. Reply ONLY with a JSON array of 3-5 objects: {\"text\": short actionable suggestion (max 12 words), \"task\": true if it can be added as a to-do}. No other text.",
        `${ctx}\n\nUser request: ${data.prompt || "What should I focus on next?"}`,
      );
      const parsed = extractJson(text);
      const items = Array.isArray(parsed)
        ? parsed.filter((x): x is { text: string; task?: boolean } => typeof x?.text === "string").map((x) => ({ text: x.text, task: x.task !== false }))
        : text.split("\n").filter(Boolean).map((l) => ({ text: l.replace(/^[-*\d.]+\s*/, "").replace(/\*\*/g, ""), task: true }));
      return { items };
    } catch (e) {
      if (e instanceof GatewayError) return { items: [], error: e.message };
      throw e;
    }
  });

export type ParsedTask = {
  title: string;
  due_at: string | null;
  remind_at: string | null;
  priority: "high" | "medium" | "normal";
  category: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly";
};

export const parseTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; now: string; tz: string }) => ({
    text: String(input.text ?? "").slice(0, 300),
    now: String(input.now ?? ""),
    tz: String(input.tz ?? "UTC").slice(0, 60),
  }))
  .handler(async ({ data }): Promise<{ task: ParsedTask | null; error?: string }> => {
    try {
      const text = await ask(
        `Convert the user's sentence into a task. Current local time: ${data.now} (timezone ${data.tz}). Reply ONLY with JSON: {"title": string, "due_at": ISO 8601 with offset or null, "remind_at": ISO 8601 with offset or null (default 15 minutes before due_at if a time is given), "priority": "high"|"medium"|"normal", "category": one of "Personal","Work","Health","Ideas","Errands" or null, "recurrence": "none"|"daily"|"weekly"|"monthly"}.`,
        data.text,
      );
      const p = extractJson(text) as Partial<ParsedTask> | null;
      if (!p?.title) return { task: null, error: "Could not understand" };
      const valid = (d: unknown) => (typeof d === "string" && !isNaN(Date.parse(d)) ? new Date(d).toISOString() : null);
      return {
        task: {
          title: String(p.title).slice(0, 200),
          due_at: valid(p.due_at),
          remind_at: valid(p.remind_at),
          priority: p.priority === "high" || p.priority === "medium" ? p.priority : "normal",
          category: typeof p.category === "string" ? p.category : null,
          recurrence: ["daily", "weekly", "monthly"].includes(p.recurrence as string) ? (p.recurrence as ParsedTask["recurrence"]) : "none",
        },
      };
    } catch (e) {
      if (e instanceof GatewayError) return { task: null, error: e.message };
      throw e;
    }
  });

export const suggestCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { note: string; fileName?: string }) => ({
    note: String(input.note ?? "").slice(0, 500),
    fileName: String(input.fileName ?? "").slice(0, 120),
  }))
  .handler(async ({ data }) => {
    try {
      const text = await ask(
        'Suggest a short warm caption (max 15 words) and 2-4 lowercase single-word tags for a personal memory. Reply ONLY with JSON {"caption": string, "tags": string[]}.',
        `Note: ${data.note || "(none)"}\nFile: ${data.fileName || "(none)"}`,
      );
      const p = extractJson(text) as { caption?: string; tags?: unknown } | null;
      return {
        caption: typeof p?.caption === "string" ? p.caption : "",
        tags: Array.isArray(p?.tags) ? p.tags.filter((t): t is string => typeof t === "string").slice(0, 4) : [],
      };
    } catch (e) {
      if (e instanceof GatewayError) return { caption: "", tags: [] as string[], error: e.message };
      throw e;
    }
  });

export const getBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: "morning" | "evening"; now: string }) => ({
    mode: input.mode === "evening" ? ("evening" as const) : ("morning" as const),
    now: String(input.now ?? "").slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const { data: tasks } = await context.supabase
      .from("tasks").select("title, done, due_at, priority, category").order("due_at", { ascending: true }).limit(40);
    const prompt = data.mode === "morning"
      ? "Write a short morning briefing (max 70 words): the 2-3 most important things for today, then one encouraging focus thought. Plain text, no markdown."
      : "Write a short warm evening reflection (max 60 words): acknowledge what got done today, gently mention what can move to tomorrow, and end with one reflective question. Plain text, no markdown.";
    try {
      const text = await ask(prompt, `Local time: ${data.now}\nTasks: ${JSON.stringify(tasks ?? [])}`);
      return { text: text.trim() };
    } catch (e) {
      if (e instanceof GatewayError) return { text: "", error: e.message };
      throw e;
    }
  });
