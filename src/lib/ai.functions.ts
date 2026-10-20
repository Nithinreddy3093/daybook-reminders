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

const LANG = "The user may write in ANY language or mix (English, Hindi, Telugu, Tamil, Hinglish, Spanish, etc.), with typos or slang. Understand it fully. Write task titles in the same language/script the user used.";
const TIME_RULES = "Time words: morning=09:00, afternoon=14:00, evening=18:00, night=21:00, tonight=today 21:00. 'tomorrow', weekdays, 'next week', dates like 25/10 or Oct 25 must be resolved relative to the current local time. If only a day is given, use 09:00. If no time/day is mentioned, due_at=null.";

export const parseTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; now: string; tz: string }) => ({
    text: String(input.text ?? "").slice(0, 1500),
    now: String(input.now ?? ""),
    tz: String(input.tz ?? "UTC").slice(0, 60),
  }))
  .handler(async ({ data }): Promise<{ tasks: ParsedTask[]; task: ParsedTask | null; error?: string }> => {
    try {
      const text = await ask(
        `You turn a message into to-do tasks. ${LANG} The message may contain several tasks (split on commas, "and", "then", new lines, numbering) — return EACH as its own task; if one item is a bigger goal, add its concrete steps as separate tasks too (max 10 total). Current local time: ${data.now} (timezone ${data.tz}). ${TIME_RULES} Reply ONLY with a JSON array of {"title": short clear title, "due_at": ISO 8601 with offset or null, "remind_at": ISO 8601 with offset or null (15 minutes before due_at when a time exists), "priority": "high"|"medium"|"normal" (high if urgent/important words), "category": one of "Personal","Work","Health","Ideas","Errands" or null, "recurrence": "none"|"daily"|"weekly"|"monthly"}.`,
        data.text,
      );
      const raw = extractJson(text);
      const arr = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Partial<ParsedTask>[];
      const valid = (d: unknown) => (typeof d === "string" && !isNaN(Date.parse(d)) ? new Date(d).toISOString() : null);
      const tasks = arr.filter((p) => p?.title).slice(0, 10).map((p) => ({
        title: String(p.title).slice(0, 200),
        due_at: valid(p.due_at),
        remind_at: valid(p.remind_at),
        priority: p.priority === "high" || p.priority === "medium" ? p.priority : "normal",
        category: typeof p.category === "string" ? p.category : null,
        recurrence: ["daily", "weekly", "monthly"].includes(p.recurrence as string) ? (p.recurrence as ParsedTask["recurrence"]) : "none",
      } satisfies ParsedTask));
      return { tasks, task: tasks[0] ?? null, error: tasks.length ? undefined : "Could not understand" };
    } catch (e) {
      if (e instanceof GatewayError) return { tasks: [], task: null, error: e.message };
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

export type CollabPlan = { title: string; due_at: string | null; remind_at: string | null; notes: string | null };

export const createCollabPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; now: string; tz: string }) => ({
    text: String(input.text ?? "").slice(0, 1000),
    now: String(input.now ?? "").slice(0, 80),
    tz: String(input.tz ?? "UTC").slice(0, 60),
  }))
  .handler(async ({ data }): Promise<{ plan: CollabPlan | null; error?: string }> => {
    try {
      const text = await ask(
        `You plan activities for two friends doing something together. ${LANG} ${TIME_RULES} Current local time: ${data.now} (timezone ${data.tz}). Turn the idea into one clear shared plan. Reply ONLY with JSON: {"title": short friendly title (max 8 words), "due_at": ISO 8601 with offset or null, "remind_at": ISO 8601 with offset or null (default 30 minutes before due_at), "notes": 1-3 short helpful lines (what to bring, steps, place) or null}.`,
        data.text,
      );
      const p = extractJson(text) as Partial<CollabPlan> | null;
      if (!p?.title) return { plan: null, error: "Could not understand" };
      const valid = (d: unknown) => (typeof d === "string" && !isNaN(Date.parse(d)) ? new Date(d).toISOString() : null);
      return { plan: { title: String(p.title).slice(0, 200), due_at: valid(p.due_at), remind_at: valid(p.remind_at), notes: typeof p.notes === "string" ? p.notes.slice(0, 1000) : null } };
    } catch (e) {
      if (e instanceof GatewayError) return { plan: null, error: e.message };
      throw e;
    }
  });
