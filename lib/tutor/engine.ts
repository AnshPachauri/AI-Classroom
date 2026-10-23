import { lesson } from "@/lib/lesson";
import { mockDecision } from "@/lib/tutor/mockEngine";
import { weakestPrerequisite } from "@/lib/store/learnerStore";
import type { Evaluation, Lesson, LearnerState, Outcome, TeachingDecision } from "@/lib/types";

// ---------- Engine interface (mock and Bedrock sit behind this) ----------

export type DecisionMode = "ask" | "reteach" | "prerequisite";

export interface DecisionRequest {
  mode: DecisionMode;
  lesson: Lesson;
  learner: LearnerState;
  question: string;
  concept: string;
  timestamp: number;
  previous?: TeachingDecision; // reteach / prerequisite: what was just shown
  prerequisite?: string; // prerequisite mode: concept to teach
  attempt?: number;
}

export interface DecisionHooks {
  /** Called as soon as the first narration sentence is known (for streaming UI). */
  onFirstSentence?: (sentence: string) => void;
}

export interface TutorEngine {
  readonly name: string;
  decide(req: DecisionRequest, hooks?: DecisionHooks): Promise<TeachingDecision>;
}

let announced = false;

export async function getEngine(): Promise<TutorEngine> {
  const useMock =
    process.env.MOCK_AI === "true" || (process.env.MOCK_AI === undefined && !process.env.BEDROCK_MODEL_ID);
  const engine: TutorEngine = useMock
    ? new (await import("@/lib/tutor/mockEngine")).MockEngine()
    : new (await import("@/lib/tutor/bedrockEngine")).BedrockEngine();
  if (!announced) {
    announced = true;
    console.log(`[tutor] engine = ${engine.name}`);
  }
  return engine;
}

// ---------- Rule-based skeleton (the LLM only supplies the teaching content) ----------

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const MASTERY = { correctFirst: 0.4, correctRetry: 0.35, wrong: -0.05, prereqTaught: 0.1 };

function log(l: LearnerState, kind: LearnerState["events"][number]["kind"], data: Record<string, unknown>) {
  l.events.push({ at: new Date().toISOString(), kind, data });
}

/** A question was asked and a decision made: remember it until the answer arrives. */
export function beginTeaching(
  l: LearnerState,
  p: { question: string; concept: string; timestamp: number },
  decision: TeachingDecision,
) {
  // The diagnosed misconception decides which concept is being taught and graded;
  // the lecture position is only context (the student may ask a beat late).
  const home = lesson.misconceptions.find((m) => m.tag === decision.diagnosis)?.concept;
  const concept = home && l.concepts[home] ? home : p.concept;
  const c = l.concepts[concept];
  c.lastSeen = new Date().toISOString();
  if (!c.misconceptions.includes(decision.diagnosis)) c.misconceptions.push(decision.diagnosis);
  l.position = p.timestamp;
  l.pending = { concept, target: concept, question: p.question, decision, wrongCount: 0 };
  log(l, "question", { question: p.question, concept, timestamp: p.timestamp, watching: p.concept });
  log(l, "decision", { action: decision.action, diagnosis: decision.diagnosis, visual: decision.visual?.id ?? null });
}

function resumeDecision(diagnosis: string, outcome: Outcome): TeachingDecision {
  const narration =
    outcome === "gave_up"
      ? "No problem. We'll come back to this later. Let's keep going."
      : outcome === "correct_first"
        ? "Spot on. Back to the lecture."
        : "That's it. Back to the lecture.";
  return { diagnosis, action: outcome === "gave_up" ? "recap" : "advance", visual: null, narration, check_question: null };
}

/**
 * Grade the answer and decide what happens next:
 *   correct          -> raise mastery, resume the lecture
 *   wrong (1st)      -> reteach with a DIFFERENT visual / simpler framing
 *   wrong (2nd)      -> teach the weakest prerequisite from the map
 *   wrong (3rd)      -> give up gracefully, flag it, resume
 */
export async function gradeAnswer(
  engine: TutorEngine,
  l: LearnerState,
  answerIndex: number,
): Promise<{ evaluation: Evaluation; next: TeachingDecision }> {
  const p = l.pending;
  const q = p?.decision.check_question;
  if (!p || !q) throw new Error("no_pending_question");

  const correct = answerIndex === q.correct_index;
  const target = l.concepts[p.target];
  target.attempts += 1;
  target.lastSeen = new Date().toISOString();
  log(l, "answer", { concept: p.target, question: q.text, answerIndex, correct });

  if (correct) {
    const outcome: Outcome = p.wrongCount === 0 ? "correct_first" : "correct_retry";
    target.mastery = clamp(target.mastery + (p.wrongCount === 0 ? MASTERY.correctFirst : MASTERY.correctRetry));
    if (p.target !== p.concept) l.concepts[p.concept].mastery = clamp(l.concepts[p.concept].mastery + MASTERY.prereqTaught);
    l.pending = null;
    log(l, "outcome", { outcome, concept: p.target });
    return {
      evaluation: { correct: true, explanation: q.expected_reasoning, attempt: p.wrongCount + 1, outcome },
      next: resumeDecision(p.decision.diagnosis, outcome),
    };
  }

  p.wrongCount += 1;
  target.mastery = clamp(target.mastery + MASTERY.wrong);
  const weak = weakestPrerequisite(l, p.concept);
  if (weak) l.concepts[weak].flagged = true;

  if (p.wrongCount >= 3) {
    l.pending = null;
    log(l, "outcome", { outcome: "gave_up", concept: p.target });
    return {
      evaluation: { correct: false, explanation: q.expected_reasoning, attempt: p.wrongCount, outcome: "gave_up" },
      next: resumeDecision(p.decision.diagnosis, "gave_up"),
    };
  }

  const mode: DecisionMode = p.wrongCount >= 2 ? "prerequisite" : "reteach";
  const prerequisite = mode === "prerequisite" ? (weak ?? p.concept) : undefined;
  const req: DecisionRequest = {
    mode,
    lesson,
    learner: l,
    question: p.question,
    concept: p.concept,
    timestamp: l.position,
    previous: p.decision,
    prerequisite,
    attempt: p.wrongCount,
  };

  let next = await engine.decide(req);
  // Rule: a reteach must change the visual. If the model repeated itself, use the safe alternative.
  if (mode === "reteach" && next.visual?.id === p.decision.visual?.id) next = mockDecision(req);

  if (prerequisite) p.target = prerequisite;
  p.decision = next;
  log(l, "decision", { action: next.action, diagnosis: next.diagnosis, visual: next.visual?.id ?? null, mode });
  return {
    evaluation: { correct: false, explanation: q.expected_reasoning, attempt: p.wrongCount, outcome: "wrong" },
    next,
  };
}
