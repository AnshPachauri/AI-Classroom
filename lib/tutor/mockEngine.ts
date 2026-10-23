import { firstSentenceOf } from "@/lib/tutor/schema";
import type { DecisionHooks, DecisionRequest, TutorEngine } from "@/lib/tutor/engine";
import type { TeachingDecision } from "@/lib/types";

/**
 * Hardcoded decisions for the demo script:
 *   ask (phasor) -> first answer wrong -> reteach (V-curve, simpler) -> second answer right.
 * Option 0 is always the default-focused button, so pressing Enter twice
 * gives "wrong, then right" on the scripted path.
 */

const ASK = {
  current: {
    diagnosis: "excitation_adds_power",
    action: "explain_visual",
    visual: { id: "phasor", params: { excitation: 0.85, load: 0.6 } },
    narration:
      "Your load hasn't changed, so the real power the motor draws stays the same. Only the reactive part of the armature current moves as you change excitation. Slide it left and right and watch the vector.",
    check_question: {
      text: "The load stays fixed and you raise excitation. What changes in the armature current?",
      options: [
        "Its in-phase part grows, because the motor works harder",
        "Nothing changes, since only the load sets the current",
        "Only its reactive part changes; the in-phase part stays fixed",
      ],
      correct_index: 2,
      expected_reasoning:
        "A fixed load fixes the real power, so the in-phase part cannot move. Excitation only changes the reactive part.",
    },
  },
  speed: {
    diagnosis: "excitation_changes_speed",
    action: "analogy",
    visual: { id: "phasor", params: { excitation: 1.0, load: 0.6 } },
    narration:
      "Think of the rotor as a dancer locked to a metronome. The supply frequency is the metronome, so the speed never changes. Excitation only changes how strongly the rotor is magnetised.",
    check_question: {
      text: "You double the field current. What happens to the motor speed?",
      options: ["It doubles", "It stays locked to the supply frequency", "It halves"],
      correct_index: 1,
      expected_reasoning: "Speed is set by supply frequency and pole count, so excitation cannot change it.",
    },
  },
  unity: {
    diagnosis: "unity_pf_max_current",
    action: "explain_visual",
    visual: { id: "vcurve", params: { excitation: 0.9, load: 0.6 } },
    narration:
      "Unity power factor means the current lines up with the voltage. Then the motor draws only real power and nothing extra. That is the bottom of the V, where the current is smallest.",
    check_question: {
      text: "At unity power factor, the armature current is…",
      options: ["At its maximum", "At its minimum for this load", "Zero"],
      correct_index: 1,
      expected_reasoning: "With current in phase with V there is no reactive part, so the current is as small as it can be.",
    },
  },
} satisfies Record<string, TeachingDecision>;

const RETEACH = {
  // after a wrong answer on a phasor explanation
  toVcurve: {
    diagnosis: "excitation_adds_power",
    action: "simplify",
    visual: { id: "vcurve", params: { excitation: 0.85, load: 0.6 } },
    narration:
      "Here's a simpler picture. Excitation is a dial for reactive current: too little and the current lags, too much and it leads. The sweet spot in the middle draws the least current.",
    check_question: {
      text: "You keep raising excitation past the bottom of the V. What happens to the armature current?",
      options: [
        "It rises again, now as leading current",
        "It keeps falling",
        "It stays flat",
      ],
      correct_index: 0,
      expected_reasoning: "Past unity, extra excitation adds leading reactive current, so the total current climbs again.",
    },
  },
  // after a wrong answer on a V-curve explanation
  toPhasor: {
    diagnosis: "unity_pf_max_current",
    action: "simplify",
    visual: { id: "phasor", params: { excitation: 1.17, load: 0.6 } },
    narration:
      "Let's look at the arrows instead. When the current points straight along the voltage, it has no sideways part. That is the shortest the current can be.",
    check_question: {
      text: "Which current arrow is shortest for this load?",
      options: [
        "One with a big sideways part",
        "One pointing exactly along V",
        "One pointing against V",
      ],
      correct_index: 1,
      expected_reasoning: "The in-phase part is fixed, so any sideways part only makes the arrow longer.",
    },
  },
} satisfies Record<string, TeachingDecision>;

const PREREQ = {
  power_factor: {
    diagnosis: "current_always_in_phase",
    action: "teach_prerequisite",
    visual: { id: "phasor", params: { excitation: 1.17, load: 0.6 } },
    narration:
      "Power factor is just the angle between voltage and current. When they line up, all the current does real work. Any sideways part is reactive: it adds current without adding power.",
    check_question: {
      text: "Current and voltage are exactly aligned. The power factor is…",
      options: ["Zero", "Unity, or 1", "Negative"],
      correct_index: 1,
      expected_reasoning: "Aligned phasors mean cos 0° = 1, so every amp does real work.",
    },
  },
  back_emf: {
    diagnosis: "current_only_from_load",
    action: "teach_prerequisite",
    visual: { id: "phasor", params: { excitation: 1.0, load: 0.6 } },
    narration:
      "The rotor field sweeps past the stator and induces a voltage called E. A stronger field gives a bigger E. The supply V and E together decide the current.",
    check_question: {
      text: "What makes the back EMF E larger?",
      options: ["A stronger rotor field", "A lower supply frequency", "A lighter load"],
      correct_index: 0,
      expected_reasoning: "E is induced by the rotor field, so a stronger field means a larger E.",
    },
  },
} satisfies Record<string, TeachingDecision>;

const clone = <T,>(x: T): T => structuredClone(x);

/** Deterministic decision for a request. Also the safe fallback for the Bedrock engine. */
export function mockDecision(req: DecisionRequest): TeachingDecision {
  if (req.mode === "ask") {
    const q = req.question;
    if (/speed|rpm|rotat|faster|slower/i.test(q)) return clone(ASK.speed);
    if (/unity|power factor|\bpf\b|lagging|leading/i.test(q)) return clone(ASK.unity);
    return clone(ASK.current);
  }
  if (req.mode === "reteach") {
    return clone(req.previous?.visual?.id === "vcurve" ? RETEACH.toPhasor : RETEACH.toVcurve);
  }
  return clone(req.prerequisite === "back_emf" ? PREREQ.back_emf : PREREQ.power_factor);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockEngine implements TutorEngine {
  readonly name = "mock";

  async decide(req: DecisionRequest, hooks?: DecisionHooks): Promise<TeachingDecision> {
    const decision = mockDecision(req);
    if (req.mode === "ask") {
      await sleep(700); // "thinking" beat, like a real model's time-to-first-token
      hooks?.onFirstSentence?.(firstSentenceOf(decision.narration));
      await sleep(1100);
    } else {
      await sleep(500);
    }
    return decision;
  }
}
