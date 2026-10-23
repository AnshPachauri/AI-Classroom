import { lesson } from "@/lib/lesson";
import { getLearnerStore, summarize } from "@/lib/store/learnerStore";
import { getEngine, gradeAnswer } from "@/lib/tutor/engine";
import { AnswerPayload } from "@/lib/tutor/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Grades the answer; returns the evaluation, the next teaching decision and fresh mastery. */
export async function POST(req: Request) {
  const parsed = AnswerPayload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { learnerId, answerIndex } = parsed.data;

  const store = getLearnerStore();
  const learner = await store.get(learnerId);
  if (!learner.pending) return Response.json({ error: "no_pending_question" }, { status: 409 });
  if (answerIndex >= (learner.pending.decision.check_question?.options.length ?? 0)) {
    return Response.json({ error: "bad_answer_index" }, { status: 400 });
  }

  try {
    const { evaluation, next } = await gradeAnswer(await getEngine(), learner, answerIndex);
    await store.save(learner);
    return Response.json({ evaluation, next, learner: summarize(learner), lessonId: lesson.id });
  } catch (err) {
    console.error("[api/answer]", err);
    return Response.json({ error: "tutor_failed" }, { status: 500 });
  }
}
