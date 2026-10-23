"use client";
import { useEffect, useRef } from "react";
import { useFocusGrid } from "@/lib/focus/useFocusGrid";
import { useSession } from "@/lib/session/sessionMachine";
import ConceptTimeline from "./ConceptTimeline";
import TVButton from "./TVButton";

function MicIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** Screen 1: video (or placeholder slides) + concept timeline + Ask + 3 suggested questions. */
export default function LessonPlayer() {
  const lesson = useSession((s) => s.lesson)!;
  const phase = useSession((s) => s.phase);
  const time = useSession((s) => s.time);
  const speed = useSession((s) => s.speed);
  const notice = useSession((s) => s.notice);
  const { tick, setTime, ask, openListening } = useSession.getState();

  const playing = phase === "playing";
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(lesson.videoUrl);

  // Placeholder lecture: a simple clock. With a real mp4 the <video> drives time instead.
  useEffect(() => {
    if (!playing || hasVideo) return;
    const id = setInterval(() => tick(0.1), 100);
    return () => clearInterval(id);
  }, [playing, hasVideo, tick]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  const chunk = lesson.chunks.find((c) => time >= c.start && time < c.end) ?? lesson.chunks[lesson.chunks.length - 1];
  const concept = lesson.concepts.find((c) => c.id === chunk.concept);

  const questions = lesson.suggestedQuestions;
  const grid = [["ask"], ...questions.map((_, i) => [`q${i}`])];
  const { is } = useFocusGrid(grid, {
    enabled: playing,
    initial: "ask",
    onEnter: (id) => {
      if (id === "ask") openListening();
      else void ask(questions[Number(id.slice(1))].text);
    },
  });

  return (
    <div className="relative h-full w-full">
      {/* header */}
      <div className="absolute left-[60px] top-[28px] right-[60px] flex items-start justify-between">
        <div>
          <div className="text-[54px] font-bold leading-none">{lesson.title}</div>
          <div className="mt-2 text-[28px] text-[var(--muted)]">{lesson.subtitle}</div>
        </div>
        <div className="rounded-full border-2 border-[var(--line)] px-6 py-2 text-[26px] text-[var(--accent)] mt-2">AI Classroom</div>
      </div>

      {/* video pane */}
      <div className="tv-card absolute left-[60px] top-[150px] h-[660px] w-[1200px] overflow-hidden">
        {hasVideo ? (
          <video
            ref={videoRef}
            src={lesson.videoUrl}
            muted
            playsInline
            className="h-full w-full object-cover"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onEnded={() => setTime(lesson.durationSec)}
          />
        ) : (
          <div
            key={chunk.id}
            className="screen-enter flex h-full w-full flex-col justify-center px-[70px]"
            style={{ background: "linear-gradient(135deg, #12233f 0%, #0b1220 60%, #0f2a3a 100%)" }}
          >
            <div className="mb-6 w-fit rounded-full bg-[rgba(56,189,248,.15)] px-6 py-2 text-[28px] font-semibold text-[var(--accent)]">
              {concept?.label}
            </div>
            <div className="text-[96px] font-bold leading-[1.05]">{chunk.title}</div>
          </div>
        )}

        {/* captions */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-[60px] pb-[34px] pt-[70px]">
          <div className="text-[34px] leading-[1.3] text-slate-100">{chunk.text}</div>
        </div>

        {!playing && (
          <div className="absolute right-6 top-6 rounded-full bg-black/70 px-6 py-2 text-[28px] font-semibold text-amber-300">
            ❚❚ Paused
          </div>
        )}
      </div>

      {/* ask column */}
      <div className="absolute left-[1300px] top-[150px] w-[560px]">
        <TVButton focused={is("ask")} onClick={openListening} tone="primary" className="flex h-[124px] w-full items-center gap-5 text-[40px]">
          <MicIcon /> Ask a question
        </TVButton>
        <div className="mb-3 mt-6 text-[26px] text-[var(--muted)]">Or pick one</div>
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <TVButton
              key={q.id}
              focused={is(`q${i}`)}
              onClick={() => void ask(q.text)}
              className="flex min-h-[128px] w-full items-center px-7 py-4 text-[29px] leading-snug"
            >
              {q.text}
            </TVButton>
          ))}
        </div>
      </div>

      {/* timeline */}
      <div className="absolute inset-x-[60px] top-[840px]">
        <ConceptTimeline lesson={lesson} time={time} />
      </div>

      {notice && (
        <div className="absolute left-1/2 top-[8px] -translate-x-1/2 rounded-full bg-amber-500 px-8 py-2 text-[26px] font-semibold text-black">
          {notice}
        </div>
      )}
      {speed > 1 && (
        <div className="absolute bottom-[12px] right-[16px] text-[20px] text-[var(--muted)]">rehearsal {speed}×</div>
      )}
    </div>
  );
}
