import type { ConceptView, MasteryStatus, PublicLesson } from "@/lib/types";

const W = 880;
const H = 520;
const NW = 172;
const NH = 80;

export const STATUS_STYLE: Record<MasteryStatus, { fill: string; text: string; name: string }> = {
  good: { fill: "#22c55e", text: "#04210f", name: "Strong" },
  weak: { fill: "#f59e0b", text: "#2a1800", name: "Needs work" },
  unseen: { fill: "#475569", text: "#e2e8f0", name: "Not seen yet" },
};

function lines(label: string): string[] {
  const i = label.indexOf(" ");
  return label.length > 9 && i > 0 ? [label.slice(0, i), label.slice(i + 1)] : [label];
}

interface Props {
  lesson: PublicLesson;
  concepts: Record<string, ConceptView>;
  /** Nodes whose status differs from this snapshot get a highlight ring. */
  compareTo?: Record<string, ConceptView> | null;
}

/** Screen 5: prerequisite graph coloured by mastery (green / amber / gray). Flagged nodes get a red flag. */
export default function ConceptMap({ lesson, concepts, compareTo }: Props) {
  const pos = (id: string) => {
    const n = lesson.concepts.find((c) => c.id === id)!;
    return { x: NW / 2 + 10 + n.x * (W - NW - 20), y: NH / 2 + 10 + n.y * (H - NH - 20) };
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Concept map">
      {/* edges: prerequisite -> concept */}
      {lesson.concepts.flatMap((n) =>
        n.prerequisites.map((p) => {
          const a = pos(p);
          const b = pos(n.id);
          const x1 = a.x + NW / 2;
          const x2 = b.x - NW / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path key={`${p}-${n.id}`} d={`M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`} fill="none" stroke="#3b4a68" strokeWidth="3" />
          );
        }),
      )}

      {lesson.concepts.map((n) => {
        const c = concepts[n.id];
        const st = STATUS_STYLE[c.status];
        const { x, y } = pos(n.id);
        const changed = compareTo ? compareTo[n.id]?.status !== c.status : false;
        const ls = lines(n.label);
        return (
          <g key={n.id}>
            {changed && (
              <rect x={x - NW / 2 - 8} y={y - NH / 2 - 8} width={NW + 16} height={NH + 16} rx="24" fill="none" stroke="#fff" strokeWidth="4" className="flag-pulse" />
            )}
            <rect
              x={x - NW / 2}
              y={y - NH / 2}
              width={NW}
              height={NH}
              rx="18"
              style={{ fill: st.fill, transition: "fill .9s ease" }}
              stroke={c.flagged ? "#f87171" : "transparent"}
              strokeWidth="5"
              strokeDasharray={c.flagged ? "10 6" : undefined}
            />
            <text textAnchor="middle" fontSize="26" fontWeight="700" style={{ fill: st.text }}>
              {ls.map((t, i) => (
                <tspan key={i} x={x} y={y + (ls.length === 1 ? 9 : i === 0 ? -6 : 24)}>
                  {t}
                </tspan>
              ))}
            </text>
            {c.flagged && (
              <g transform={`translate(${x + NW / 2 - 22}, ${y - NH / 2 - 22})`} className="flag-pulse">
                <circle cx="22" cy="22" r="22" fill="#0b1220" stroke="#f87171" strokeWidth="3" />
                <path d="M14 33V11M14 12h16l-4 6 4 6H14" fill="#f87171" stroke="#f87171" strokeWidth="2.5" strokeLinejoin="round" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function MapLegend() {
  return (
    <div className="flex items-center justify-center gap-10 text-[26px] text-slate-300">
      {(Object.keys(STATUS_STYLE) as MasteryStatus[]).map((k) => (
        <span key={k} className="flex items-center gap-3">
          <span className="inline-block h-[22px] w-[22px] rounded-md" style={{ background: STATUS_STYLE[k].fill }} />
          {STATUS_STYLE[k].name}
        </span>
      ))}
      <span className="flex items-center gap-3">
        <span className="inline-block h-[22px] w-[22px] rounded-md border-[3px] border-dashed border-red-400" />
        Flagged
      </span>
    </div>
  );
}
