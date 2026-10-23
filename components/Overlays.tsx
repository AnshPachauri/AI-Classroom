"use client";
import { useEffect, useRef, useState } from "react";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { useSession } from "@/lib/session/sessionMachine";
import TVButton from "./TVButton";

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

/** Listening: shows what the TV "heard", or lets the student pick a question. */
export function Listening() {
  const lesson = useSession((s) => s.lesson)!;
  const question = useSession((s) => s.question);
  const { ask, back } = useSession.getState();
  const speech = useSpeech((t) => t.trim().length > 1 && void ask(t.trim()));

  const questions = lesson.suggestedQuestions;
  const picking = question === null;
  const ids = [...questions.map((_, i) => `q${i}`), ...(speech.supported ? ["mic"] : [])];
  const { is } = useFocusGrid(picking ? ids.map((i) => [i]) : [], {
    onEnter: (id) => (id === "mic" ? speech.toggle() : void ask(questions[Number(id.slice(1))].text)),
    onBack: back,
  });

  return (
    <Backdrop>
      <Orb size={picking ? 110 : 150} />
      <div className="mt-8 text-[64px] font-bold">{speech.active ? "Listening…" : picking ? "What's confusing?" : "Got it"}</div>

      {picking ? (
        <div className="mt-10 flex w-[1200px] flex-col gap-5">
          {questions.map((q, i) => (
            <TVButton key={q.id} focused={is(`q${i}`)} onClick={() => void ask(q.text)} className="flex h-[112px] items-center text-[38px]">
              {q.text}
            </TVButton>
          ))}
          {speech.supported && (
            <TVButton focused={is("mic")} onClick={speech.toggle} tone="ghost" className="flex h-[100px] items-center justify-center text-[34px]">
              {speech.active ? "Listening… say your question" : "Or say it (microphone)"}
            </TVButton>
          )}
          <div className="text-center text-[26px] text-[var(--muted)]">Back to cancel</div>
        </div>
      ) : (
        <div className="mt-8 max-w-[1400px] text-center text-[56px] leading-tight text-slate-100">“{question}”</div>
      )}
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
