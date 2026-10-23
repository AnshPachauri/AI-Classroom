import { z } from "zod";
import type { TeachingDecision } from "@/lib/types";

export const ACTIONS = [
  "explain_visual",
  "simplify",
  "analogy",
  "teach_prerequisite",
  "ask_check",
  "advance",
  "recap",
] as const;

export const VISUAL_IDS = ["phasor", "vcurve"] as const;

// Parameter ranges the visuals can actually render.
export const EXCITATION_RANGE = { min: 0.75, max: 1.65 } as const;
export const LOAD_RANGE = { min: 0.3, max: 0.7 } as const;

const VisualSchema = z.object({
  id: z.enum(VISUAL_IDS),
  params: z
    .object({
      excitation: z.number().min(EXCITATION_RANGE.min).max(EXCITATION_RANGE.max).optional(),
      load: z.number().min(LOAD_RANGE.min).max(LOAD_RANGE.max).optional(),
    })
    .default({}),
});

const CheckSchema = z
  .object({
    text: z.string().min(5).max(240),
    options: z.array(z.string().min(1).max(170)).min(2).max(4),
    correct_index: z.number().int().min(0),
    expected_reasoning: z.string().min(5).max(400),
  })
  .refine((q) => q.correct_index < q.options.length, { message: "correct_index out of range" });

const NEEDS_CHECK = new Set(["explain_visual", "simplify", "analogy", "teach_prerequisite", "ask_check"]);

/** Strict decision schema; `tags` is the lesson's known-misconception list. */
export function makeDecisionSchema(tags: string[]) {
  return z
    .object({
      diagnosis: z.enum(tags as [string, ...string[]]),
      action: z.enum(ACTIONS),
      visual: VisualSchema.nullable().optional(),
      narration: z.string().min(5).max(600),
      check_question: CheckSchema.nullable().optional(),
    })
    .superRefine((d, ctx) => {
      if (d.action === "explain_visual" && !d.visual) {
        ctx.addIssue({ code: "custom", message: "explain_visual needs a visual" });
      }
      if (NEEDS_CHECK.has(d.action) && !d.check_question) {
        ctx.addIssue({ code: "custom", message: "action needs a check_question" });
      }
    });
}

/**
 * Validate raw model output. `interactive` = the decision must be playable
 * on the Visual Stage (a visual AND a check question).
 * Returns null when anything is outside the allowed set.
 */
export function parseDecision(raw: unknown, tags: string[], interactive: boolean): TeachingDecision | null {
  const res = makeDecisionSchema(tags).safeParse(raw);
  if (!res.success) return null;
  const d = res.data;
  if (interactive && (!d.visual || !d.check_question)) return null;
  return d;
}

/** Pull a JSON object out of model text (tolerates code fences / chatter). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** First complete sentence of the "narration" field in a partially streamed JSON string. */
export function firstNarrationSentence(partial: string): string | null {
  const m = partial.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)("?)/);
  if (!m) return null;
  const text = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"');
  const s = text.match(/^.*?[.!?](?=\s)/);
  if (s) return s[0].trim();
  return m[2] === '"' && text.length > 4 ? text.trim() : null; // narration closed with a single sentence
}

export function firstSentenceOf(text: string): string {
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0].trim() ?? text;
}

// ---------- API payloads ----------

export const StartPayload = z.object({
  learnerId: z.string().default("demo"),
  reset: z.boolean().default(false),
});

export const AskPayload = z.object({
  learnerId: z.string().default("demo"),
  question: z.string().min(2).max(300),
  timestamp: z.number().min(0),
  concept: z.string().optional(),
});

export const AnswerPayload = z.object({
  learnerId: z.string().default("demo"),
  answerIndex: z.number().int().min(0).max(3),
});
