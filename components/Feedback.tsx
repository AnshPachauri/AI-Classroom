"use client";
import { useEffect, useState } from "react";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { useSession } from "@/lib/session/sessionMachine";
import { VISUALS } from "@/visuals";
import ConceptMap, { MapLegend } from "./ConceptMap";
import TVButton from "./TVButton";

/**
 * Screen 4. Two variants:
 *  - reteach (wrong answer): the evaluation + what the new approach will be
 *  - resume  (correct answer): the evaluation + the concept map updating live
 */
export default function Feedback() {
  const phase = useSession((s) => s.phase);
  const evaluation = useSession((s) => s.evaluation)!;
  const decision = useSession((s) => s.decision)!;
  const lesson = useSession((s) => s.lesson)!;
  const concepts = useSession((s) => s.concepts)!;
  const prev = useSession((s) => s.prevConcepts);
  const { continueFromFeedback } = useSession.getState();

  const { is } = useFocusGrid([["go"]], { initial: "go", onEnter: continueFromFeedback });

  // Live update: start from the old colours, then flip to the new ones.
  const [shown, setShown] = useState(prev ?? concepts);
  useEffect(() => {
    const id = setTimeout(() => setShown(concepts), 700);
    return () => clearTimeout(id);
  }, [concepts]);

  const reteach = phase === "reteach";
  const good = evaluation.correct;

  const improved = lesson.concepts.filter((n) => prev && prev[n.id].status !== "good" && concepts[n.id].status === "good").map((n) => n.label);
  const flagged = lesson.concepts.filter((n) => concepts[n.id].flagged).map((n) => n.label);

  const title = good ? "Correct!" : reteach ? "Not quite" : "Let's move on";
  const tone = good ? "text-green-400" : "text-amber-400";
  const next = decision.visual ? VISUALS[decision.visual.id].label : null;

  return (
    <div className="screen-enter relative h-full w-full">
      <div className={`absolute left-[110px] top-[90px] text-[112px] font-bold ${tone}`}>{title}</div>

      <div className="absolute left-[110px] top-[250px] w-[760px] text-[44px] leading-[1.3] text-slate-100">{evaluation.explanation}</div>

      {reteach ? (
        <>
          <div className="tv-card absolute left-[110px] top-[560px] w-[1000px] px-12 py-9">
            <div className="text-[30px] text-[var(--muted)]">Let's try a different way in</div>
            <div className="mt-3 text-[50px] font-bold text-[var(--accent)]">
              {next} · {decision.action === "analogy" ? "an analogy" : "simpler framing"}
            </div>
          </div>
          <TVButton focused={is("go")} onClick={continueFromFeedback} tone="primary" className="absolute left-[110px] top-[800px] flex h-[120px] w-[640px] items-center justify-center text-[44px]">
            Show me  ▸
          </TVButton>
        </>
      ) : (
        <>
          <div className="absolute left-[110px] top-[570px] w-[760px] text-[34px] leading-snug text-slate-300">
            {improved.length > 0 && <div>↑ Now solid: <b className="text-green-400">{improved.join(", ")}</b></div>}
            {flagged.length > 0 && <div className="mt-3">⚑ To revisit: <b className="text-red-300">{flagged.join(", ")}</b></div>}
          </div>
          <div className="absolute left-[900px] top-[120px] w-[960px]">
            <div className="mb-3 text-[30px] text-[var(--muted)]">What the TV now knows about you</div>
            <div className="tv-card h-[580px] p-5">
              <ConceptMap lesson={lesson} concepts={shown} compareTo={prev} />
            </div>
            <div className="mt-6"><MapLegend /></div>
          </div>
          <TVButton focused={is("go")} onClick={continueFromFeedback} tone="primary" className="absolute left-[110px] top-[800px] flex h-[120px] w-[760px] items-center justify-center text-[44px]">
            Continue lecture  ▸
          </TVButton>
        </>
      )}
    </div>
  );
}
