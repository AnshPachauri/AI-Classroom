"use client";
import { useEffect, useRef, useState } from "react";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { useSession } from "@/lib/session/sessionMachine";

/** Optional voice (Web Speech API). Chips are the primary input; this is an enhancement only. */
function useSpeech(onResult: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const rec = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const cb = useRef(onResult);
  cb.current = onResult;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e: any) => cb.current(String(e.results?.[0]?.[0]?.transcript ?? "")); // eslint-disable-line @typescript-eslint/no-explicit-any
    r.onend = () => setActive(false);
    r.onerror = () => setActive(false);
    rec.current = r;
    setSupported(true);
    return () => {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const toggle = () => {
    if (!rec.current) return;
    try {
      if (active) rec.current.stop();
      else {
        rec.current.start();
        setActive(true);
      }
    } catch {
      setActive(false);
    }
  };
  return { supported, active, toggle };
}

function Orb({ size = 150 }: { size?: number }) {
  return (
    <div
      className="orb rounded-full"
      style={{ width: size, height: size, background: "radial-gradient(circle at 35% 30%, #bae6fd, #0ea5e9 55%, #075985)" }}
    />
  );
}

const Backdrop = ({ children }: { children: React.ReactNode }) => (
  <div className="screen-enter absolute inset-0 z-10 flex flex-col items-center justify-center bg-[rgba(5,7,13,.97)]">{children}</div>
);

/**
 * Scripted voice capture for the demo: a waveform plays while the next suggested question
 * "transcribes" word by word, then it's asked. No mic permission, so it can't fail on stage.
 * `?voice=real` swaps in the Web Speech API instead.
 */
let scriptedTurn = 0;
function useScriptedVoice(script: string, enabled: boolean, onDone: (text: string) => void) {
  const [heard, setHeard] = useState("");
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    if (!enabled) return;
    const words = script.split(" ");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const LEAD = 1100, STEP = 210;
    words.forEach((_, i) => timers.push(setTimeout(() => setHeard(words.slice(0, i + 1).join(" ")), LEAD + i * STEP)));
    timers.push(setTimeout(() => cb.current(script), LEAD + words.length * STEP + 700));
    return () => timers.forEach(clearTimeout);
  }, [script, enabled]);

  return heard;
}

function Waveform({ live }: { live: boolean }) {
  return (
    <div className="mt-10 flex h-[120px] items-center gap-[10px]">
      {Array.from({ length: 28 }, (_, i) => (
        <div
          key={i}
          className={live ? "wave-bar" : ""}
          style={{
            width: 12,
            height: live ? 110 : 14,
            borderRadius: 6,
            background: "var(--accent)",
            opacity: live ? 0.9 : 0.35,
            animationDelay: `${-((i * 137) % 900)}ms`,
            animationDuration: `${700 + ((i * 53) % 500)}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Listening: captures the spoken question (scripted by default), then shows what the TV heard. */
export function Listening() {
  const lesson = useSession((s) => s.lesson)!;
  const question = useSession((s) => s.question);
  const { ask, back } = useSession.getState();
  const [realVoice] = useState(() => new URLSearchParams(window.location.search).get("voice") === "real");
  const [script] = useState(() => {
    const qs = lesson.suggestedQuestions;
    return qs[scriptedTurn++ % qs.length].text;
  });

  const capturing = question === null;
  const speech = useSpeech((t) => t.trim().length > 1 && void ask(t.trim()));
  const heard = useScriptedVoice(script, capturing && !realVoice, (t) => void ask(t));

  useEffect(() => {
    if (capturing && realVoice && speech.supported && !speech.active) speech.toggle();
  }, [capturing, realVoice, speech.supported]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusGrid([], {
    onEnter: () => capturing && !realVoice && void ask(script),
    onBack: back,
  });

  const live = capturing && (!realVoice || speech.active);
  return (
    <Backdrop>
      <Orb size={capturing ? 120 : 150} />
      <div className="mt-8 text-[64px] font-bold">{capturing ? "Listening…" : "Got it"}</div>
      {capturing && <Waveform live={live} />}
      <div className="mt-8 min-h-[150px] max-w-[1400px] text-center text-[56px] leading-tight text-slate-100">
        {capturing ? (heard ? <>“{heard}<span className="caret">|</span>”</> : <span className="text-[var(--muted)]">Say your question</span>) : <>“{question}”</>}
      </div>
      {capturing && <div className="absolute bottom-[40px] text-[24px] text-[var(--muted)]">Back to cancel</div>}
    </Backdrop>
  );
}

/** Thinking: a status line and the first narration sentence, so the pause never feels dead. */
export function Thinking() {
  const question = useSession((s) => s.question);
  const status = useSession((s) => s.statusLine);
  const first = useSession((s) => s.firstSentence);
  const { back } = useSession.getState();
  useFocusGrid([], { onBack: back });

  return (
    <Backdrop>
      <Orb />
      <div className="mt-8 max-w-[1400px] text-center text-[40px] text-[var(--muted)]">“{question}”</div>
      <div className="mt-8 min-h-[70px] text-[52px] font-semibold text-[var(--accent)]">{status || "Thinking…"}</div>
      <div className="mt-8 min-h-[200px] w-[1300px]">
        {first && (
          <div key={first} className="screen-enter tv-card px-12 py-9 text-center text-[48px] leading-snug">
            {first}
          </div>
        )}
      </div>
      <div className="absolute bottom-[40px] text-[24px] text-[var(--muted)]">Back to cancel</div>
    </Backdrop>
  );
}
