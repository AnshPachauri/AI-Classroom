import { chunkAt, conceptLabel, lesson } from "@/lib/lesson";
import { getLearnerStore } from "@/lib/store/learnerStore";
import { beginTeaching, getEngine } from "@/lib/tutor/engine";
import { AskPayload } from "@/lib/tutor/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams newline-delimited JSON events so the TV never feels dead:
 *   {type:"status"}  ->  {type:"first_sentence"}  ->  {type:"decision"} | {type:"error"}
 */
export async function POST(req: Request) {
  const parsed = AskPayload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { learnerId, question, timestamp, concept: hint } = parsed.data;

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        send({ type: "status", text: "Understanding your question…" });
        const store = getLearnerStore();
        const learner = await store.get(learnerId);
        const concept = lesson.concepts.some((c) => c.id === hint) ? hint! : chunkAt(timestamp).concept;
        send({ type: "status", text: `Checking what you know about ${conceptLabel(concept)}…` });

        const engine = await getEngine();
        const decision = await engine.decide(
          { mode: "ask", lesson, learner, question, concept, timestamp },
          {
            onFirstSentence: (text) => {
              send({ type: "status", text: "Preparing the visual…" });
              send({ type: "first_sentence", text });
            },
          },
        );

        beginTeaching(learner, { question, concept, timestamp }, decision);
        await store.save(learner);
        send({ type: "decision", decision });
      } catch (err) {
        console.error("[api/ask]", err);
        send({ type: "error", message: "The tutor could not answer right now." });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
