"use client";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { useSession } from "@/lib/session/sessionMachine";
import TVButton from "./TVButton";

const LETTERS = ["A", "B", "C", "D"];

/** Screen 3: one multiple-choice question with big buttons. */
export default function CheckQuestion() {
  const decision = useSession((s) => s.decision)!;
  const q = decision.check_question!;
  const { answer, back } = useSession.getState();

  const { is } = useFocusGrid(q.options.map((_, i) => [`o${i}`]), {
    initial: "o0",
    onEnter: (id) => void answer(Number(id.slice(1))),
    onBack: back,
  });

  return (
    <div className="screen-enter flex h-full w-full flex-col px-[110px] pt-[80px]">
      <div className="mb-8 w-fit rounded-full bg-[rgba(56,189,248,.15)] px-7 py-2 text-[30px] font-semibold text-[var(--accent)]">Quick check</div>
      <div className="mb-14 text-[62px] font-bold leading-[1.15]">{q.text}</div>

      <div className="flex flex-col gap-6">
        {q.options.map((opt, i) => (
          <TVButton key={i} focused={is(`o${i}`)} onClick={() => void answer(i)} className="flex min-h-[150px] items-center gap-8 py-5 text-[42px] leading-snug">
            <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full bg-[rgba(56,189,248,.18)] text-[40px] font-bold text-[var(--accent)]">
              {LETTERS[i]}
            </span>
            {opt}
          </TVButton>
        ))}
      </div>
      <div className="mt-auto pb-8 text-center text-[24px] text-[var(--muted)]">▲ ▼ choose · Enter to answer · Back to review the visual</div>
    </div>
  );
}
