import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

export const getSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt?: string }) => ({ prompt: (input.prompt ?? "").slice(0, 500) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: tasks }, { data: memories }] = await Promise.all([
      supabase.from("tasks").select("title, done, due_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("memories").select("caption, created_at").order("created_at", { ascending: false }).limit(15),
    ]);
    const ctx = `Tasks: ${JSON.stringify(tasks ?? [])}\nMemories: ${JSON.stringify(memories ?? [])}\nNow: ${new Date().toISOString()}`;
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "You are a warm, concise personal planning assistant. Give 3-5 short, actionable suggestions as a markdown bullet list (no headings). Reference the user's actual tasks and memories when useful.",
        input: `${ctx}\n\nUser request: ${data.prompt || "What should I focus on next?"}`,
      });
      const text = res.output
        .flatMap((o) => (o.type === "message" ? o.content : []))
        .map((c) => (c.type === "output_text" ? c.text : ""))
        .join("");
      return { text };
    } catch (e) {
      if (e instanceof GatewayError) return { text: "", error: e.message };
      throw e;
    }
  });
