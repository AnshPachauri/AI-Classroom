import { BedrockRuntimeClient, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { mockDecision } from "@/lib/tutor/mockEngine";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/tutor/prompts";
import { extractJson, firstNarrationSentence, firstSentenceOf, parseDecision } from "@/lib/tutor/schema";
import type { DecisionHooks, DecisionRequest, TutorEngine } from "@/lib/tutor/engine";
import type { TeachingDecision } from "@/lib/types";

/**
 * Real tutor: one Claude call on Amazon Bedrock (Converse streaming API).
 * Server-side only. Credentials come from the standard AWS provider chain;
 * model id from BEDROCK_MODEL_ID. Any failure or invalid JSON falls back to a
 * safe, pre-authored decision so the demo never dead-ends.
 */
export class BedrockEngine implements TutorEngine {
  readonly name = "bedrock";
  private client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });

  async decide(req: DecisionRequest, hooks?: DecisionHooks): Promise<TeachingDecision> {
    const tags = req.lesson.misconceptions.map((m) => m.tag);
    try {
      const modelId = process.env.BEDROCK_MODEL_ID;
      if (!modelId) throw new Error("BEDROCK_MODEL_ID is not set");

      const out = await this.client.send(
        new ConverseStreamCommand({
          modelId,
          system: [{ text: SYSTEM_PROMPT }],
          messages: [{ role: "user", content: [{ text: buildUserPrompt(req) }] }],
          inferenceConfig: { maxTokens: 900, temperature: 0.3 },
        }),
      );

      let text = "";
      let announced = false;
      for await (const ev of out.stream ?? []) {
        const delta = ev.contentBlockDelta?.delta?.text;
        if (!delta) continue;
        text += delta;
        if (!announced && hooks?.onFirstSentence) {
          const s = firstNarrationSentence(text);
          if (s) {
            announced = true;
            hooks.onFirstSentence(s);
          }
        }
      }

      const decision = parseDecision(extractJson(text), tags, true);
      if (!decision) throw new Error("model output failed validation");
      return decision;
    } catch (err) {
      console.error("[tutor/bedrock] falling back to safe decision:", err);
      const fallback = mockDecision(req);
      hooks?.onFirstSentence?.(firstSentenceOf(fallback.narration));
      return fallback;
    }
  }
}
