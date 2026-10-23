import type { ComponentType } from "react";
import type { VisualId } from "@/lib/types";
import PhasorDiagram from "./PhasorDiagram";
import VCurve from "./VCurve";

export interface VisualProps {
  value: number; // excitation, driven by the slider
  load?: number;
}

export interface VisualEntry {
  id: VisualId;
  label: string;
  Component: ComponentType<VisualProps>;
}

/** The AI picks an id + starting params from this registry. It never generates graphics. */
export const VISUALS: Record<VisualId, VisualEntry> = {
  phasor: { id: "phasor", label: "Phasor diagram", Component: PhasorDiagram },
  vcurve: { id: "vcurve", label: "V-curve", Component: VCurve },
};

export { motorPoint, unityExcitation, EXC_MIN, EXC_MAX, EXC_STEP, clampExc } from "./physics";
