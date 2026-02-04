export type BezierCurve = { x1: number; y1: number; x2: number; y2: number };

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-6;
const SUBDIVISION_PRECISION = 1e-7;
const SUBDIVISION_MAX_ITERATIONS = 12;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const coeffs = (p1: number, p2: number) => {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return { a, b, c };
};

const sampleCurve = (t: number, a: number, b: number, c: number) =>
  ((a * t + b) * t + c) * t;

const sampleCurveDerivative = (t: number, a: number, b: number, c: number) =>
  (3 * a * t + 2 * b) * t + c;

const solveCurveX = (x: number, cx: number, bx: number, ax: number) => {
  let t = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
    const xEst = sampleCurve(t, ax, bx, cx) - x;
    const dEst = sampleCurveDerivative(t, ax, bx, cx);
    if (Math.abs(dEst) < NEWTON_MIN_SLOPE) break;
    t -= xEst / dEst;
  }

  let t0 = 0;
  let t1 = 1;
  let t2 = t;
  for (let i = 0; i < SUBDIVISION_MAX_ITERATIONS; i += 1) {
    const xEst = sampleCurve(t2, ax, bx, cx);
    const delta = xEst - x;
    if (Math.abs(delta) < SUBDIVISION_PRECISION) return t2;
    if (delta > 0) {
      t1 = t2;
    } else {
      t0 = t2;
    }
    t2 = (t0 + t1) / 2;
  }
  return t2;
};

export function evalBezier(t: number, curve: BezierCurve): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;

  const { a: ax, b: bx, c: cx } = coeffs(clamp01(curve.x1), clamp01(curve.x2));
  const { a: ay, b: by, c: cy } = coeffs(clamp01(curve.y1), clamp01(curve.y2));

  const solvedT = solveCurveX(x, cx, bx, ax);
  return sampleCurve(solvedT, ay, by, cy);
}
