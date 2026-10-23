/**
 * Per-unit synchronous-motor model shared by both visuals.
 * V = 1 (reference), Xs = 1, constant load => constant real power P.
 *   P = V·E·sinδ / Xs        Ia = [E·sinδ + j(E·cosδ − V)] / Xs
 * Real (in-phase) part of Ia is fixed by the load; excitation only moves the reactive part.
 */
export interface MotorPoint {
  E: number; // back EMF (≈ excitation, per unit)
  delta: number; // load angle, radians
  ip: number; // in-phase current (fixed by load)
  iq: number; // reactive current: + leading, − lagging
  ia: number; // |Ia|
  pf: number;
}

export const V = 1;

export function motorPoint(excitation: number, load = 0.6): MotorPoint {
  const E = Math.max(excitation, load + 0.02);
  const delta = Math.asin(load / E);
  const ip = load;
  const iq = E * Math.cos(delta) - V;
  const ia = Math.hypot(ip, iq);
  return { E, delta, ip, iq, ia, pf: ip / ia };
}

/** Excitation at which the current is in phase with V (unity power factor). */
export const unityExcitation = (load = 0.6) => Math.hypot(load, V);

export const EXC_MIN = 0.75;
export const EXC_MAX = 1.65;
export const EXC_STEP = 0.025;

export const clampExc = (x: number) => Math.min(EXC_MAX, Math.max(EXC_MIN, x));
