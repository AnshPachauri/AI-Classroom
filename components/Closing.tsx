"use client";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { restart, useSession } from "@/lib/session/sessionMachine";
import ConceptMap, { MapLegend } from "./ConceptMap";
import TVButton from "./TVButton";

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Fact({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="tv-card flex-1 px-8 py-6">
      <div className={`text-[26px] font-semibold uppercase tracking-wide ${tone}`}>{title}</div>
      <div className="mt-3 text-[34px] leading-snug text-slate-100">{children}</div>
    </div>
  );
}

/** Closing screen: before/after concept map + what the TV now knows about the student. */
export default function Closing() {
  const lesson = useSession((s) => s.lesson)!;
  const before = useSession((s) => s.before)!;
  const after = useSession((s) => s.concepts)!;
  const { is } = useFocusGrid([["restart"]], { initial: "restart", onEnter: () => void restart() });

  const gained = lesson.concepts.filter((n) => after[n.id].mastery - before[n.id].mastery >= 0.2);
  const flagged = lesson.concepts.filter((n) => after[n.id].flagged);
  const seen = Array.from(new Set(lesson.concepts.flatMap((n) => after[n.id].misconceptions)))
    .map((tag) => lesson.misconceptions.find((m) => m.tag === tag)?.label ?? tag);

  return (
    <div className="screen-enter relative h-full w-full px-[60px] pt-[30px]">
      <div className="text-[58px] font-bold">What your TV now knows about you</div>

      <div className="mt-5 flex gap-[40px]">
        {[
          { name: "Before", data: before, compare: null },
          { name: "After", data: after, compare: before },
        ].map((m) => (
          <div key={m.name} className="w-[880px]">
            <div className="mb-2 text-[32px] font-semibold text-[var(--accent)]">{m.name}</div>
            <div className="tv-card h-[520px] overflow-hidden p-2">
              <ConceptMap lesson={lesson} concepts={m.data} compareTo={m.compare} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5"><MapLegend /></div>

      <div className="mt-6 flex gap-6">
        <Fact title="Strengthened" tone="text-green-400">
          {gained.length ? gained.map((n) => `${n.label} ${pct(before[n.id].mastery)} → ${pct(after[n.id].mastery)}`).join(" · ") : "Nothing yet"}
        </Fact>
        <Fact title="Needs review" tone="text-red-300">
          {flagged.length ? flagged.map((n) => n.label).join(", ") : "Nothing flagged"}
        </Fact>
        <Fact title="Misconception spotted" tone="text-amber-300">
          {seen.length ? seen.join(", ") : "None"}
        </Fact>
      </div>

      <TVButton focused={is("restart")} onClick={() => void restart()} tone="ghost" className="absolute bottom-[22px] left-1/2 flex h-[76px] w-[420px] -translate-x-1/2 items-center justify-center text-[32px]">
        Restart demo  ↻
      </TVButton>
    </div>
  );
}
