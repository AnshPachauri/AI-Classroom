import { conceptLabel } from "@/lib/lesson";
import type { DecisionRequest } from "@/lib/tutor/engine";

export const SYSTEM_PROMPT = `You are the on-screen tutor of a Fire TV lesson on synchronous motor excitation.
A student paused the lecture to ask a question. Diagnose the misconception behind it, pick ONE interactive visual to confront it, narrate briefly, and ask ONE check question.

Reply with ONE strict JSON object and nothing else (no markdown, no commentary):
{
  "diagnosis": "<one tag from KNOWN MISCONCEPTIONS>",
  "action": "explain_visual | simplify | analogy | teach_prerequisite | ask_check | advance | recap",
  "visual": { "id": "phasor | vcurve", "params": { "excitation": <number>, "load": <number> } },
  "narration": "<2-3 SHORT spoken sentences; the first must stand on its own>",
  "check_question": { "text": "...", "options": ["...", "...", "..."], "correct_index": 0, "expected_reasoning": "<one sentence>" }
}

Rules:
- You never draw graphics. You only choose a visual id and its starting params.
- Visuals: "phasor" = phasor diagram (V, E, armature current Ia) driven by an excitation slider; "vcurve" = armature current vs excitation.
- Params: excitation in [0.75, 1.65] per-unit (unity power factor is near 1.17 at load 0.6); load in [0.3, 0.7] (default 0.6, rarely change it). Start the slider away from unity so moving it teaches something.
- Physics to stay consistent with: constant supply V, constant mechanical load => constant real power => the in-phase part of Ia is fixed. Excitation changes E and therefore only the reactive part of Ia. Under-excited: Ia lags V. Over-excited: Ia leads. Unity power factor = MINIMUM Ia. Speed is fixed by supply frequency.
- Narration: at most 45 words in total, plain spoken English, no markdown, no LaTeX.
- check_question: 3 options (2-4 allowed), exactly one correct, distractors must reflect the known misconceptions. Test the idea, not recall of the narration.
- Keep every string short; this is read on a TV from 10 feet.`;

export function buildUserPrompt(req: DecisionRequest): string {
  const { lesson, learner } = req;

  const transcript = lesson.chunks
    .map((c) => `[${c.start}-${c.end}s | ${c.concept}] ${c.text}`)
    .join("\n");

  const graph = lesson.concepts
    .map((c) => `${c.id} (${c.label}) <- ${c.prerequisites.join(", ") || "none"}`)
    .join("\n");

  const state = lesson.concepts
    .map((c) => {
      const s = learner.concepts[c.id];
      return `${c.id}: mastery ${s.mastery.toFixed(2)}, attempts ${s.attempts}, misconceptions [${s.misconceptions.join(", ")}]`;
    })
    .join("\n");

  const misconceptions = lesson.misconceptions.map((m) => `${m.tag}: ${m.description}`).join("\n");

  return [
    `LESSON TRANSCRIPT (concept-tagged):\n${transcript}`,
    `PREREQUISITE MAP:\n${graph}`,
    `LEARNER STATE:\n${state}`,
    `KNOWN MISCONCEPTIONS:\n${misconceptions}`,
    `SITUATION:\nThe student paused at ${req.timestamp.toFixed(0)}s while the lecture was on "${conceptLabel(req.concept, lesson)}".\nStudent question: "${req.question}"`,
    modeInstruction(req),
  ].join("\n\n");
}

function modeInstruction(req: DecisionRequest): string {
  const prev = req.previous;
  const prevLine = prev
    ? `The previous explanation used action "${prev.action}" with visual "${prev.visual?.id ?? "none"}" and this narration: "${prev.narration}". The student then answered its check question WRONG.`
    : "";

  switch (req.mode) {
    case "ask":
      return `TASK: Diagnose the misconception behind the question and teach it. Use action "explain_visual" (or "analogy" if the question is conceptual, not about the diagram). Include visual and check_question.`;
    case "reteach":
      return `TASK: RETEACH. ${prevLine}\nUse a DIFFERENT visual id than "${prev?.visual?.id}" and a simpler framing (action "simplify" or "analogy"). Do not repeat the earlier wording. Ask a NEW check question that probes the same idea from a new angle.`;
    case "prerequisite":
      return `TASK: PREREQUISITE. ${prevLine}\nThe student has now missed twice, so the gap is likely the prerequisite "${req.prerequisite}" (${conceptLabel(req.prerequisite ?? "", req.lesson)}). Use action "teach_prerequisite": teach only that prerequisite in the simplest terms, then ask a check question about it.`;
  }
}
