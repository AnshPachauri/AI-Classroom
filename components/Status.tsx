"use client";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { restart, useSession } from "@/lib/session/sessionMachine";
import TVButton from "./TVButton";

/** Loading / boot-error screen. */
export function Boot() {
  const phase = useSession((s) => s.phase);
  const error = useSession((s) => s.bootError);
  const { is } = useFocusGrid([["retry"]], { enabled: phase === "error", onEnter: () => void restart() });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="text-[84px] font-bold">AI Classroom</div>
      {phase === "error" ? (
        <>
          <div className="mt-8 text-[40px] text-amber-300">{error}</div>
          <TVButton focused={is("retry")} onClick={() => void restart()} tone="primary" className="mt-10 flex h-[100px] w-[360px] items-center justify-center text-[38px]">
            Retry
          </TVButton>
        </>
      ) : (
        <div className="mt-8 text-[40px] text-[var(--muted)]">Loading lesson…</div>
      )}
    </div>
  );
}

/** Shown while the server grades the answer. */
export function Evaluating() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="orb h-[130px] w-[130px] rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #bbf7d0, #22c55e 55%, #14532d)" }} />
      <div className="mt-10 text-[58px] font-semibold">Checking your answer…</div>
    </div>
  );
}
