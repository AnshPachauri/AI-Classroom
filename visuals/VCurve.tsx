import { EXC_MAX, EXC_MIN, motorPoint, unityExcitation } from "./physics";

const X0 = 130, X1 = 940, Y0 = 640, Y1 = 90; // plot box (screen)
const IA_MIN = 0.45, IA_MAX = 0.95;

interface Props {
  value: number; // excitation
  load?: number;
}

const sx = (e: number) => X0 + ((e - EXC_MIN) / (EXC_MAX - EXC_MIN)) * (X1 - X0);
const sy = (ia: number) => Y0 - ((ia - IA_MIN) / (IA_MAX - IA_MIN)) * (Y0 - Y1);

/** V-curve: armature current vs excitation at constant load. The slider moves the dot. */
export default function VCurve({ value, load = 0.6 }: Props) {
  const pts: string[] = [];
  for (let e = EXC_MIN; e <= EXC_MAX + 1e-9; e += 0.01) pts.push(`${sx(e).toFixed(1)},${sy(motorPoint(e, load).ia).toFixed(1)}`);

  const unity = unityExcitation(load);
  const here = motorPoint(value, load);
  const px = sx(value);
  const py = sy(here.ia);
  const ux = sx(unity);
  const under = value < unity - 0.015;
  const over = value > unity + 0.015;

  return (
    <svg viewBox="0 0 1000 760" className="h-full w-full" role="img" aria-label="V-curve">
      {/* zones */}
      <rect x={X0} y={Y1 - 20} width={ux - X0} height={Y0 - Y1 + 20} fill="#f59e0b" opacity=".07" />
      <rect x={ux} y={Y1 - 20} width={X1 - ux} height={Y0 - Y1 + 20} fill="#38bdf8" opacity=".07" />
      <text x={(X0 + ux) / 2} y={Y1 + 10} fill="#fbbf24" fontSize="30" textAnchor="middle">Under-excited · lagging</text>
      <text x={(ux + X1) / 2} y={Y1 + 10} fill="#7dd3fc" fontSize="30" textAnchor="middle">Over-excited · leading</text>

      {/* axes */}
      <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke="#475569" strokeWidth="3" />
      <line x1={X0} y1={Y1 - 20} x2={X0} y2={Y0} stroke="#475569" strokeWidth="3" />
      <text x={(X0 + X1) / 2} y={Y0 + 70} fill="#94a3b8" fontSize="32" textAnchor="middle">Excitation (field current) →</text>
      <text x={40} y={(Y0 + Y1) / 2} fill="#94a3b8" fontSize="32" textAnchor="middle" transform={`rotate(-90 40 ${(Y0 + Y1) / 2})`}>
        Armature current →
      </text>

      {/* curve */}
      <polyline points={pts.join(" ")} fill="none" stroke="#e2e8f0" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />

      {/* unity marker */}
      <line x1={ux} y1={sy(load)} x2={ux} y2={Y0} stroke="#22c55e" strokeWidth="3" strokeDasharray="8 8" />
      <text x={ux} y={Y0 + 34} fill="#4ade80" fontSize="28" textAnchor="middle">unity PF</text>

      {/* guides + moving point */}
      <line x1={px} y1={py} x2={px} y2={Y0} stroke="#22d3ee" strokeWidth="3" strokeDasharray="6 8" />
      <line x1={X0} y1={py} x2={px} y2={py} stroke="#22d3ee" strokeWidth="3" strokeDasharray="6 8" />
      <circle cx={px} cy={py} r="30" fill="#22d3ee" opacity=".25" />
      <circle cx={px} cy={py} r="17" fill="#22d3ee" stroke="#0b1220" strokeWidth="4" />
      <text x={px + (px > 780 ? -28 : 28)} y={py - 28} fill="#22d3ee" fontSize="34" fontWeight="700" textAnchor={px > 780 ? "end" : "start"}>
        {under ? "lagging" : over ? "leading" : "unity"}
      </text>
    </svg>
  );
}
