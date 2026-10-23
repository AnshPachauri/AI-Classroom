import { lesson, publicLesson } from "@/lib/lesson";
import { getLearnerStore, summarize } from "@/lib/store/learnerStore";
import { StartPayload } from "@/lib/tutor/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loads the lesson + learner state and says where playback should start. */
export async function POST(req: Request) {
  const parsed = StartPayload.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { learnerId, reset } = parsed.data;

  const store = getLearnerStore();
  const learner = reset ? await store.reset(learnerId) : await store.get(learnerId);
  const startAt = learner.position < lesson.durationSec ? learner.position : 0;

  return Response.json({ lesson: publicLesson(), learner: summarize(learner), startAt });
}
