"use client";
import { useEffect } from "react";
import CheckQuestion from "@/components/CheckQuestion";
import Closing from "@/components/Closing";
import Feedback from "@/components/Feedback";
import LessonPlayer from "@/components/LessonPlayer";
import { Listening, Thinking } from "@/components/Overlays";
import { Boot, Evaluating } from "@/components/Status";
import TVCanvas from "@/components/TVCanvas";
import VisualStage from "@/components/VisualStage";
import { useSession } from "@/lib/session/sessionMachine";

function Screen() {
  const phase = useSession((s) => s.phase);
  const seq = useSession((s) => s.decisionSeq);

  switch (phase) {
    case "loading":
    case "error":
      return <Boot />;
    case "playing":
    case "listening":
    case "thinking":
      return (
        <>
          <LessonPlayer />
          {phase === "listening" && <Listening />}
          {phase === "thinking" && <Thinking />}
        </>
      );
    case "explaining":
      return <VisualStage key={seq} />;
    case "checking":
      return <CheckQuestion key={seq} />;
    case "evaluating":
      return <Evaluating />;
    case "reteach":
    case "resume":
      return <Feedback key={`${phase}-${seq}`} />;
    case "closing":
      return <Closing />;
  }
}

/** TV app root. `?keep=1` keeps learner state across reloads; `?speed=3` speeds the lecture for rehearsal. */
export default function Page() {
  useEffect(() => {
    void useSession.getState().start(!new URLSearchParams(window.location.search).has("keep"));
  }, []);

  return (
    <TVCanvas>
      <Screen />
    </TVCanvas>
  );
}
