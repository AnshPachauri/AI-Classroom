import { motorPoint } from "./physics";

const S = 450; // px per per-unit
const O = { x: 130, y: 400 }; // origin

interface Props {
  value: number; // excitation
  load?: number;
}

function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse" viewBox="0 0 9 9">
      <path d="M0,0 L9,4.5 L0,9 z" fill={color} />
    </marker>
  );
}

/** Phasor diagram: V (reference), E (rotor field), Ia (armature current). Y axis points up. */
export default function PhasorDiagram({ value, load = 0.6 }: Props) {
  const m = motorPoint(value, load);
  const P = (re: number, im: number) => ({ x: O.x + S * re, y: O.y - S * im }); // math -> screen

  const vTip = P(1, 0);
  const eTip = P(m.E * Math.cos(m.delta), -m.E * Math.sin(m.delta)); // E lags V
  const iTip = P(m.ip, m.iq);
  const ipTip = P(m.ip, 0);

  return (
    <svg viewBox="0 0 1000 760" className="h-full w-full" role="img" aria-label="Phasor diagram">
      <defs>
        <Arrow id="a-v" color="#e2e8f0" />
        <Arrow id="a-e" color="#fbbf24" />
        <Arrow id="a-i" color="#22d3ee" />
      </defs>

      {/* axes */}
      <line x1={O.x - 60} y1={O.y} x2={940} y2={O.y} stroke="#26314a" strokeWidth="2" />
      <line x1={O.x} y1={60} x2={O.x} y2={720} stroke="#26314a" strokeWidth="2" />

      {/* voltage drop across Xs = V − E = jXs·Ia */}
      <line x1={eTip.x} y1={eTip.y} x2={vTip.x} y2={vTip.y} stroke="#64748b" strokeWidth="4" strokeDasharray="12 10" />
      <text x={(eTip.x + vTip.x) / 2 + 18} y={(eTip.y + vTip.y) / 2 + 40} fill="#94a3b8" fontSize="30">jXs·Ia</text>

      {/* current components: in-phase (fixed by load) and reactive (moved by excitation) */}
      <line x1={O.x} y1={O.y + 14} x2={ipTip.x} y2={ipTip.y + 14} stroke="#22d3ee" strokeWidth="6" strokeDasharray="3 9" strokeLinecap="round" />
      <line x1={ipTip.x} y1={ipTip.y} x2={iTip.x} y2={iTip.y} stroke="#f472b6" strokeWidth="7" strokeDasharray="3 9" strokeLinecap="round" />

      {/* V */}
      <line x1={O.x} y1={O.y} x2={vTip.x} y2={vTip.y} stroke="#e2e8f0" strokeWidth="8" markerEnd="url(#a-v)" />
      <text x={vTip.x + 22} y={vTip.y - 14} fill="#e2e8f0" fontSize="40" fontWeight="700">V</text>

      {/* E */}
      <line x1={O.x} y1={O.y} x2={eTip.x} y2={eTip.y} stroke="#fbbf24" strokeWidth="8" markerEnd="url(#a-e)" />
      <text x={eTip.x + 22} y={eTip.y + 36} fill="#fbbf24" fontSize="40" fontWeight="700">E</text>

      {/* Ia */}
      <line x1={O.x} y1={O.y} x2={iTip.x} y2={iTip.y} stroke="#22d3ee" strokeWidth="10" markerEnd="url(#a-i)" />
      <text x={iTip.x + 26} y={iTip.y - 6} fill="#22d3ee" fontSize="44" fontWeight="700">Ia</text>

      {/* legend */}
      <g fontSize="30">
        <line x1="40" y1="52" x2="100" y2="52" stroke="#22d3ee" strokeWidth="6" strokeDasharray="3 9" strokeLinecap="round" />
        <text x="116" y="62" fill="#67e8f9">In-phase part: fixed by the load</text>
        <line x1="40" y1="104" x2="100" y2="104" stroke="#f472b6" strokeWidth="7" strokeDasharray="3 9" strokeLinecap="round" />
        <text x="116" y="114" fill="#f9a8d4">Reactive part: moved by excitation</text>
      </g>
      <circle cx={O.x} cy={O.y} r="8" fill="#e2e8f0" />
    </svg>
  );
}
