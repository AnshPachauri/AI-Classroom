import type { PublicLesson } from "@/lib/types";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Lecture progress, one segment per concept. The current concept is highlighted. */
export default function ConceptTimeline({ lesson, time }: { lesson: PublicLesson; time: number }) {
  return (
    <div className="w-full">
      <div className="mb-3 flex items-baseline justify-between text-[26px] text-[var(--muted)]">
        <span>Lecture timeline</span>
        <span className="tabular-nums">
          {fmt(time)} / {fmt(lesson.durationSec)}
        </span>
      </div>

      <div className="flex gap-[8px]">
        {lesson.chunks.map((c) => {
          const label = lesson.concepts.find((n) => n.id === c.concept)?.label ?? c.concept;
          const progress = Math.min(1, Math.max(0, (time - c.start) / (c.end - c.start)));
          const current = time >= c.start && time < c.end;
          const done = time >= c.end;
          return (
            <div key={c.id} className="flex-1">
              <div className="h-[22px] overflow-hidden rounded-full bg-[var(--panel2)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    background: current ? "var(--accent)" : "#3b82a6",
                  }}
                />
              </div>
              <div
                className={`mt-3 text-center text-[25px] leading-tight ${
                  current ? "font-bold text-white" : done ? "text-slate-300" : "text-[var(--muted)]"
                }`}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
