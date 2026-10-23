"use client";

type Tone = "default" | "primary" | "ghost";

interface Props {
  focused: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

const TONES: Record<Tone, string> = {
  default: "bg-[var(--panel2)] border-2 border-[var(--line)] text-white",
  primary: "bg-[var(--accent)] border-2 border-transparent text-[#04121f] font-bold",
  ghost: "bg-transparent border-2 border-[var(--line)] text-slate-200",
};

/** Big D-pad-friendly button. Focus is owned by useFocusGrid; `focused` draws the ring. */
export default function TVButton({ focused, onClick, children, tone = "default", className = "" }: Props) {
  return (
    <button
      tabIndex={-1}
      data-focused={focused}
      onClick={(e) => {
        e.currentTarget.blur(); // keep Enter/Space on the keyboard handler only
        onClick();
      }}
      className={`focus-ring rounded-[28px] px-10 text-left ${TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
