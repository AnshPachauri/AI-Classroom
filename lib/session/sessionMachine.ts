import { create } from "zustand";
import type { ConceptView, Evaluation, LearnerSummary, PublicLesson, TeachingDecision } from "@/lib/types";

/**
 * On-device session state machine.
 *   playing -> listening -> thinking -> explaining -> checking -> evaluating -> reteach | resume
 *   reteach -> explaining (new approach)      resume -> playing      playing -> closing (lecture ends)
 * Illegal transitions are ignored, so a stray key press can't break the loop.
 */
export type Phase =
  | "loading"
  | "playing"
  | "listening"
  | "thinking"
  | "explaining"
  | "checking"
  | "evaluating"
  | "reteach"
  | "resume"
  | "closing"
  | "error";

const NEXT: Record<Phase, Phase[]> = {
  loading: ["playing", "error"],
  playing: ["listening", "closing"],
  listening: ["playing", "thinking"],
  thinking: ["explaining", "playing"],
  explaining: ["checking", "playing"],
  checking: ["evaluating", "explaining"],
  evaluating: ["reteach", "resume", "playing"],
  reteach: ["explaining"],
  resume: ["playing", "closing"],
  closing: ["loading"],
  error: ["loading"],
};

type Concepts = Record<string, ConceptView>;

interface Session {
  phase: Phase;
  lesson: PublicLesson | null;
  time: number; // lecture position, seconds
  speed: number; // rehearsal aid: ?speed=3
  question: string | null;
  statusLine: string;
  firstSentence: string;
  decision: TeachingDecision | null;
  decisionSeq: number; // bumps per decision so screens remount cleanly
  evaluation: Evaluation | null;
  before: Concepts | null; // snapshot at session start
  prevConcepts: Concepts | null; // snapshot before the last answer
  concepts: Concepts | null; // live
  notice: string | null;
  bootError: string | null;

  start: (reset?: boolean) => Promise<void>;
  tick: (dt: number) => void;
  setTime: (t: number) => void;
  openListening: () => void;
  ask: (question: string) => Promise<void>;
  finishExplaining: () => void;
  answer: (index: number) => Promise<void>;
  continueFromFeedback: () => void;
  back: () => void;
}

const LEARNER = "demo";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let controller: AbortController | null = null;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const useSession = create<Session>((set, get) => {
  /** Guarded transition: returns false (and does nothing) if illegal. */
  const go = (to: Phase) => {
    const from = get().phase;
    if (from !== to && !NEXT[from].includes(to)) return false;
    set({ phase: to });
    return true;
  };

  const currentConcept = () => {
    const { lesson, time } = get();
    if (!lesson) return undefined;
    return (lesson.chunks.find((c) => time >= c.start && time < c.end) ?? lesson.chunks.at(-1))?.concept;
  };

  const showDecision = (decision: TeachingDecision) =>
    set((s) => ({ decision, decisionSeq: s.decisionSeq + 1 }));

  const finishLecture = async () => {
    if (!go("closing")) return;
    try {
      const res = await fetch(`/api/learner/summary?learnerId=${LEARNER}`, { cache: "no-store" });
      const summary: LearnerSummary = await res.json();
      set({ concepts: summary.concepts });
    } catch {
      /* keep the last known concepts */
    }
  };

  return {
    phase: "loading",
    lesson: null,
    time: 0,
    speed: 1,
    question: null,
    statusLine: "",
    firstSentence: "",
    decision: null,
    decisionSeq: 0,
    evaluation: null,
    before: null,
    prevConcepts: null,
    concepts: null,
    notice: null,
    bootError: null,

    async start(reset = true) {
      const params = new URLSearchParams(window.location.search);
      const speed = Math.min(10, Math.max(1, Number(params.get("speed")) || 1));
      set({ phase: "loading", bootError: null, notice: null, decision: null, evaluation: null, question: null, speed });
      try {
        const data = await postJson<{ lesson: PublicLesson; learner: LearnerSummary; startAt: number }>(
          "/api/session/start",
          { learnerId: LEARNER, reset },
        );
        set({
          lesson: data.lesson,
          time: data.startAt,
          before: data.learner.concepts,
          concepts: data.learner.concepts,
          prevConcepts: null,
          phase: "playing",
        });
      } catch {
        set({ phase: "error", bootError: "Couldn't load the lesson." });
      }
    },

    tick(dt) {
      const { phase, lesson, time, speed } = get();
      if (phase !== "playing" || !lesson) return;
      const t = time + dt * speed;
      if (t >= lesson.durationSec) {
        set({ time: lesson.durationSec });
        void finishLecture();
      } else {
        set({ time: t });
      }
    },

    setTime(t) {
      const { phase, lesson } = get();
      if (phase !== "playing" || !lesson) return;
      if (t >= lesson.durationSec - 0.05) {
        set({ time: lesson.durationSec });
        void finishLecture();
      } else set({ time: t });
    },

    openListening() {
      if (go("listening")) set({ question: null, notice: null });
    },

    async ask(question) {
      const from = get().phase;
      if (from !== "playing" && from !== "listening") return;
      set({ phase: "listening", question, notice: null, statusLine: "", firstSentence: "", decision: null });
      await sleep(900); // let the student see what the TV "heard"
      if (get().phase !== "listening" || get().question !== question) return;
      go("thinking");
      set({ statusLine: "Understanding your question…" });

      const ctrl = new AbortController();
      controller = ctrl;
      let shownAt = 0;
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ learnerId: LEARNER, question, timestamp: get().time, concept: currentConcept() }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error("ask failed");

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            const ev = JSON.parse(line);
            if (get().phase !== "thinking") return;
            if (ev.type === "status") set({ statusLine: ev.text });
            else if (ev.type === "first_sentence") {
              shownAt = Date.now();
              set({ firstSentence: ev.text });
            } else if (ev.type === "error") throw new Error(ev.message);
            else if (ev.type === "decision") {
              // keep the first sentence on screen long enough to read
              if (shownAt) await sleep(Math.max(0, 1700 - (Date.now() - shownAt)));
              if (get().phase !== "thinking") return;
              showDecision(ev.decision);
              go("explaining");
              return;
            }
          }
        }
        throw new Error("stream ended without a decision");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        set({ notice: "Couldn't reach the tutor. Try asking again." });
        go("playing");
      }
    },

    finishExplaining() {
      if (get().phase !== "explaining") return;
      if (get().decision?.check_question) go("checking");
      else go("playing");
    },

    async answer(index) {
      if (get().phase !== "checking") return;
      go("evaluating");
      const prev = get().concepts;
      try {
        const [res] = await Promise.all([
          postJson<{ evaluation: Evaluation; next: TeachingDecision; learner: LearnerSummary }>("/api/answer", {
            learnerId: LEARNER,
            answerIndex: index,
          }),
          sleep(800), // a beat so "Checking your answer…" registers
        ]);
        set({ evaluation: res.evaluation, prevConcepts: prev, concepts: res.learner.concepts });
        if (res.next.check_question) {
          showDecision(res.next);
          go("reteach");
        } else {
          showDecision(res.next);
          go("resume");
        }
      } catch {
        set({ notice: "Couldn't check that answer. Back to the lecture." });
        go("playing");
      }
    },

    continueFromFeedback() {
      const { phase } = get();
      if (phase === "reteach") go("explaining");
      else if (phase === "resume") {
        const { lesson, time } = get();
        if (lesson && time >= lesson.durationSec) void finishLecture();
        else go("playing");
      }
    },

    back() {
      const { phase } = get();
      if (phase === "listening") go("playing");
      else if (phase === "thinking") {
        controller?.abort();
        go("playing");
      } else if (phase === "explaining") go("playing");
      else if (phase === "checking") go("explaining");
    },
  };
});

export function restart() {
  return useSession.getState().start(true);
}
