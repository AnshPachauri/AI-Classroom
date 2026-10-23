// Shared types (server + client). No runtime code here.

export type Action =
  | "explain_visual"
  | "simplify"
  | "analogy"
  | "teach_prerequisite"
  | "ask_check"
  | "advance"
  | "recap";

export type VisualId = "phasor" | "vcurve";

export interface VisualSpec {
  id: VisualId;
  params: { excitation?: number; load?: number };
}

export interface CheckQuestion {
  text: string;
  options: string[];
  correct_index: number;
  expected_reasoning: string;
}

export interface TeachingDecision {
  diagnosis: string;
  action: Action;
  visual?: VisualSpec | null;
  narration: string;
  check_question?: CheckQuestion | null;
}

export interface Chunk {
  id: string;
  start: number;
  end: number;
  concept: string;
  title: string;
  text: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  prerequisites: string[];
  x: number; // 0..1 layout hints for the concept map
  y: number;
}

export interface Misconception {
  tag: string;
  label: string;
  concept: string; // the concept this misconception belongs to (what gets checked and graded)
  description: string;
  signals: string[];
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  videoUrl: string;
  durationSec: number;
  suggestedQuestions: { id: string; text: string }[];
  chunks: Chunk[];
  concepts: ConceptNode[];
  misconceptions: Misconception[];
}

/** What the browser needs: misconception labels only (descriptions stay server-side). */
export type PublicLesson = Omit<Lesson, "misconceptions"> & { misconceptions: { tag: string; label: string }[] };

// ---------- Learner state ----------

export interface ConceptState {
  mastery: number; // 0..1
  attempts: number;
  misconceptions: string[];
  lastSeen: string | null;
  flagged: boolean;
}

export interface LearnerEvent {
  at: string;
  kind: "question" | "decision" | "answer" | "outcome";
  data: Record<string, unknown>;
}

/** The teaching moment currently waiting for an answer (server-authoritative). */
export interface Pending {
  concept: string; // concept the student was watching
  target: string; // concept being checked (differs while teaching a prerequisite)
  question: string;
  decision: TeachingDecision;
  wrongCount: number;
}

export interface LearnerState {
  id: string;
  position: number;
  concepts: Record<string, ConceptState>;
  events: LearnerEvent[];
  pending: Pending | null;
}

export type MasteryStatus = "good" | "weak" | "unseen";

export interface ConceptView {
  mastery: number;
  status: MasteryStatus;
  flagged: boolean;
  misconceptions: string[];
}

export interface LearnerSummary {
  concepts: Record<string, ConceptView>;
  misconceptions: { tag: string; label: string; concept: string }[];
  eventCount: number;
}

export type Outcome = "correct_first" | "correct_retry" | "wrong" | "gave_up";

export interface Evaluation {
  correct: boolean;
  explanation: string;
  attempt: number;
  outcome: Outcome;
}
