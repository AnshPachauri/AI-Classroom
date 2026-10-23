import { getLearnerStore, summarize } from "@/lib/store/learnerStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The concept-mastery view: what the TV currently believes about the student. */
export async function GET(req: Request) {
  const learnerId = new URL(req.url).searchParams.get("learnerId") ?? "demo";
  const learner = await getLearnerStore().get(learnerId);
  return Response.json(summarize(learner));
}
