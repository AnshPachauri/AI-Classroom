"use client";
import { useState } from "react";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { useSession } from "@/lib/session/sessionMachine";
import { clampExc, EXC_MAX, EXC_MIN, EXC_STEP, motorPoint, VISUALS } from "@/visuals";
import TVButton from "./TVButton";

const fmt = (n: number) => n.toFixed(2);

function Row({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[30px] text-[var(--muted)]">{label}</span>
      <span className={`text-[42px] font-bold tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

/** Screen 2: full-screen interactive visual. Left/Right moves the excitation slider live. */
export default function VisualStage() {
  const decision = useSession((s) => s.decision)!;
  const lesson = useSession((s) => s.lesson)!;
  const { finishExplaining, back } = useSession.getState();

  const spec = VISUALS[decision.visual?.id ?? "phasor"];
  const load = decision.visual?.params.load ?? 0.6;
  const [value, setValue] = useState(clampExc(decision.visual?.params.excitation ?? 0.85));

  const { is } = useFocusGrid([["slider"], ["continue"]], {
    initial: "slider",
    onArrow: (dir, id) => {
      if (id !== "slider" || (dir !== "left" && dir !== "right")) return false;
      setValue((v) => clampExc(Math.round((v + (dir === "right" ? EXC_STEP : -EXC_STEP)) / EXC_STEP) * EXC_STEP));
      return true;
    },
    onEnter: finishExplaining,
    onBack: back,
  });

  const m = motorPoint(value, load);
  const lead = m.iq > 0.05;
  const lag = m.iq < -0.05;
  const diagnosis = lesson.misconceptions.find((x) => x.tag === decision.diagnosis)?.label;
  const pct = (value - EXC_MIN) / (EXC_MAX - EXC_MIN);
  const View = spec.Component;

  return (
    <div className="screen-enter relative h-full w-full">
      {/* visual */}
      <div className="tv-card absolute left-[40px] top-[40px] h-[800px] w-[1180px] p-4">
        <View value={value} load={load} />
      </div>

      {/* slider */}
      <div
        data-focused={is("slider")}
        className="focus-ring tv-card absolute left-[40px] top-[866px] h-[92px] w-[1180px] px-10"
      >
        <div className="flex h-full items-center gap-8">
          <span className="w-[150px] text-[28px] text-amber-300">◀ Under</span>
          <div className="relative h-[16px] flex-1 rounded-full bg-[var(--panel2)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct * 100}%` }} />
            <div
              className="absolute top-1/2 h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-[#04121f] bg-white shadow-[0_0_24px_rgba(56,189,248,.8)]"
              style={{ left: `${pct * 100}%` }}
            />
          </div>
          <span className="w-[150px] text-right text-[28px] text-sky-300">Over ▶</span>
        </div>
      </div>

      <TVButton focused={is("continue")} onClick={finishExplaining} tone="primary" className="absolute left-[40px] top-[978px] flex h-[84px] w-[1180px] items-center justify-center text-[38px]">
        {decision.check_question ? "Quiz me  ▸" : "Continue  ▸"}
      </TVButton>

      {/* right panel */}
      <div className="absolute left-[1260px] top-[40px] flex h-[1000px] w-[620px] flex-col gap-5">
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-[rgba(56,189,248,.15)] px-5 py-2 text-[26px] font-semibold text-[var(--accent)]">{spec.label}</span>
          {diagnosis && <span className="rounded-full bg-[rgba(245,158,11,.15)] px-5 py-2 text-[24px] text-amber-300">Spotted: {diagnosis}</span>}
        </div>

        <div className="tv-card flex-1 px-9 py-8 text-[35px] leading-[1.35] text-slate-100">{decision.narration}</div>

        <div className="tv-card flex flex-col gap-3 px-9 py-7">
          <Row label="Excitation (E)" value={`${fmt(m.E)} pu`} tone="text-amber-300" />
          <Row label="Armature current" value={`${fmt(m.ia)} pu`} tone="text-cyan-300" />
          <Row label="In-phase part" value={fmt(m.ip)} />
          <Row label="Reactive part" value={`${m.iq > 0 ? "+" : ""}${fmt(m.iq)}`} />
          <Row label="Power factor" value={`${fmt(m.pf)} ${lead ? "leading" : lag ? "lagging" : "unity"}`} tone={lead || lag ? "text-white" : "text-green-400"} />
        </div>

        <div className="text-center text-[24px] text-[var(--muted)]">◀ ▶ move the slider · Enter to continue · Back to leave</div>
      </div>
    </div>
  );
}
