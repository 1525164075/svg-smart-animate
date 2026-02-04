import { svgPathProperties } from 'svg-path-properties';
import svgpath from 'svgpath';
import type { NormalizedPathNode } from './normalize';
import type { OrbitDirection, OrbitMode } from './types';
import { bboxFromPathD, type BBox } from './geom';

export type OrbitCandidate = {
  id: string;
  d: string;
  bbox: BBox;
  center: { x: number; y: number };
  radius: number;
  length: number;
  props: svgPathProperties;
};

export type OrbitBinding = {
  candidate: OrbitCandidate;
  t0: number;
  t1: number;
  delta: number; // signed delta in [-1,1]
};

const DEFAULT_SAMPLES = 120;

function isClosedPath(d: string): boolean {
  return /[zZ]\s*$/.test(d.trim());
}

export function parseOrbitId(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
}

export function parseOrbitDir(raw: string | undefined): OrbitDirection | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'cw' || v === 'ccw' || v === 'shortest') return v;
  return null;
}

export function collectOrbitCandidates(nodes: NormalizedPathNode[]): OrbitCandidate[] {
  const out: OrbitCandidate[] = [];

  for (const n of nodes) {
    if (!isClosedPath(n.d)) continue;
    // Prefer stroke-visible shapes as orbits.
    if (!n.stroke || n.stroke === 'none') continue;

    const id = n.attrs.id || n.id;
    if (!id) continue;

    const bbox = bboxFromPathD(n.d);
    const radius = Math.max(1, Math.min(bbox.width, bbox.height) / 2);

    let props: svgPathProperties;
    try {
      props = new svgPathProperties(n.d);
    } catch {
      continue;
    }

    const length = props.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) continue;

    out.push({
      id,
      d: n.d,
      bbox,
      center: { x: bbox.cx, y: bbox.cy },
      radius,
      length,
      props
    });
  }

  return out;
}

function projectPointOnOrbit(candidate: OrbitCandidate, point: { x: number; y: number }, samples = DEFAULT_SAMPLES) {
  let bestT = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = candidate.props.getPointAtLength(candidate.length * t);
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestT = t;
    }
  }

  return { t: bestT, distance: bestDist };
}

function resolveDirectionDelta(t0: number, t1: number, direction: OrbitDirection): number {
  const cw = (t1 - t0 + 1) % 1;
  const ccw = (t0 - t1 + 1) % 1;

  if (direction === 'cw') return cw;
  if (direction === 'ccw') return -ccw;

  return cw <= ccw ? cw : -ccw;
}

export function resolveOrbitBinding(opts: {
  mode: OrbitMode;
  direction: OrbitDirection;
  tolerance: number;
  manualId?: string | null;
  manualDir?: OrbitDirection | null;
  candidates: OrbitCandidate[];
  startCenter: { x: number; y: number };
  endCenter: { x: number; y: number };
}): OrbitBinding | null {
  const { mode } = opts;
  if (mode === 'off') return null;

  const direction = opts.manualDir ?? opts.direction;

  if (mode === 'auto+manual' && opts.manualId) {
    const cand = opts.candidates.find((c) => c.id === opts.manualId);
    if (cand) {
      const p0 = projectPointOnOrbit(cand, opts.startCenter);
      const p1 = projectPointOnOrbit(cand, opts.endCenter);
      const delta = resolveDirectionDelta(p0.t, p1.t, direction);
      return { candidate: cand, t0: p0.t, t1: p1.t, delta };
    }
  }

  if (mode === 'auto' || mode === 'auto+manual') {
    let best: OrbitBinding | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const cand of opts.candidates) {
      const tol = Math.max(opts.tolerance, cand.radius * 0.05);
      const p0 = projectPointOnOrbit(cand, opts.startCenter);
      const p1 = projectPointOnOrbit(cand, opts.endCenter);
      if (p0.distance > tol || p1.distance > tol) continue;

      const score = p0.distance + p1.distance;
      if (score < bestScore) {
        bestScore = score;
        const delta = resolveDirectionDelta(p0.t, p1.t, direction);
        best = { candidate: cand, t0: p0.t, t1: p1.t, delta };
      }
    }

    return best;
  }

  return null;
}

export function orbitPoint(binding: OrbitBinding, local: number): { x: number; y: number } {
  const t = (binding.t0 + binding.delta * local) % 1;
  const tt = t < 0 ? t + 1 : t;
  return binding.candidate.props.getPointAtLength(binding.candidate.length * tt);
}

export function translatePath(d: string, dx: number, dy: number): string {
  return svgpath(d).translate(dx, dy).toString();
}
