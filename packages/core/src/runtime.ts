import type { AnimateController, AnimateSvgArgs, AnimateSvgOptions } from './types';
import { parseSvgToNodes } from './parse';
import { normalizeNodes, type NormalizedPathNode } from './normalize';
import { matchNodes } from './match';
import { createPathInterpolator } from './morph';
import { makeAppearStartPath } from './appear';
import { bboxFromPathD, parseColorToRgba, type Rgba } from './geom';
import { linear } from './easing';

type Track = {
  pathEl: SVGPathElement;
  startD: string;
  endD: string;
  interp: (t: number) => string;
  startFill: string | undefined;
  endFill: string | undefined;
  startStroke: string | undefined;
  endStroke: string | undefined;
  startOpacity: number;
  endOpacity: number;
};

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgbaToCss(c: Rgba): string {
  const r = Math.round(c.r);
  const g = Math.round(c.g);
  const b = Math.round(c.b);
  const a = Math.max(0, Math.min(1, c.a));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function lerpColor(a: string | undefined, b: string | undefined, t: number): string | undefined {
  if (a === b) return a;

  const ca = parseColorToRgba(a);
  const cb = parseColorToRgba(b);

  if (!ca && !cb) return b ?? a;
  if (!ca || !cb) return t < 0.5 ? a : b;

  return rgbaToCss({
    r: lerp(ca.r, cb.r, t),
    g: lerp(ca.g, cb.g, t),
    b: lerp(ca.b, cb.b, t),
    a: lerp(ca.a, cb.a, t)
  });
}

function computeViewBox(nodes: NormalizedPathNode[]): { minX: number; minY: number; width: number; height: number } {
  if (nodes.length === 0) return { minX: 0, minY: 0, width: 100, height: 100 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const n of nodes) {
    const b = bboxFromPathD(n.d);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  // Add small padding to avoid clipping strokes.
  const pad = Math.max(width, height) * 0.05;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: width + pad * 2,
    height: height + pad * 2
  };
}

function deriveMaxSegmentLength(options?: AnimateSvgOptions): number {
  const samplePoints = options?.samplePoints;
  if (!samplePoints || !Number.isFinite(samplePoints)) return 2;
  // Heuristic: more points => smaller segments.
  const v = 200 / Math.max(8, samplePoints);
  return Math.max(0.5, Math.min(10, v));
}

export function createAnimator(args: AnimateSvgArgs): AnimateController {
  const { container } = args;
  const options = args.options;
  const duration = options?.duration ?? 600;
  const easing = options?.easing ?? linear;

  const endRaw = parseSvgToNodes(args.endSvg);
  const endNodes = normalizeNodes(endRaw);

  let startNodes: NormalizedPathNode[];
  if (args.startSvg) {
    const startRaw = parseSvgToNodes(args.startSvg);
    startNodes = normalizeNodes(startRaw);
  } else {
    const style = options?.appearStyle ?? 'collapse-to-centroid';
    startNodes = endNodes.map((n) => {
      return {
        ...n,
        d: makeAppearStartPath(n.d, { style }),
        opacity: 0
      };
    });
  }

  // Build tracks: matched pairs + appear/disappear fallbacks.
  const match = matchNodes(startNodes, endNodes, options?.matchWeights);

  // Reset container.
  container.innerHTML = '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const vbFrom = endNodes.length ? endNodes : startNodes;
  const vb = computeViewBox(vbFrom);
  svg.setAttribute('viewBox', `${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`);

  container.appendChild(svg);

  const maxSegmentLength = deriveMaxSegmentLength(options);

  const tracks: Track[] = [];

  function mkPathEl(): SVGPathElement {
    return document.createElementNS('http://www.w3.org/2000/svg', 'path');
  }

  for (const p of match.pairs) {
    const pathEl = mkPathEl();
    svg.appendChild(pathEl);

    tracks.push({
      pathEl,
      startD: p.start.d,
      endD: p.end.d,
      interp: createPathInterpolator(p.start.d, p.end.d, { maxSegmentLength }),
      startFill: p.start.fill,
      endFill: p.end.fill,
      startStroke: p.start.stroke,
      endStroke: p.end.stroke,
      startOpacity: p.start.opacity ?? 1,
      endOpacity: p.end.opacity ?? 1
    });
  }

  // End-only: appear
  for (const e of match.unmatchedEnd) {
    const startD = makeAppearStartPath(e.d, { style: options?.appearStyle ?? 'collapse-to-centroid' });

    const pathEl = mkPathEl();
    svg.appendChild(pathEl);

    tracks.push({
      pathEl,
      startD,
      endD: e.d,
      interp: createPathInterpolator(startD, e.d, { maxSegmentLength }),
      startFill: e.fill,
      endFill: e.fill,
      startStroke: e.stroke,
      endStroke: e.stroke,
      startOpacity: 0,
      endOpacity: e.opacity ?? 1
    });
  }

  // Start-only: disappear
  for (const s of match.unmatchedStart) {
    const endD = makeAppearStartPath(s.d, { style: 'collapse-to-centroid' });

    const pathEl = mkPathEl();
    svg.appendChild(pathEl);

    tracks.push({
      pathEl,
      startD: s.d,
      endD,
      interp: createPathInterpolator(s.d, endD, { maxSegmentLength }),
      startFill: s.fill,
      endFill: s.fill,
      startStroke: s.stroke,
      endStroke: s.stroke,
      startOpacity: s.opacity ?? 1,
      endOpacity: 0
    });
  }

  let rafId: number | null = null;
  let currentT = 0;

  function render(t: number): void {
    const tt = clamp01(t);

    for (const tr of tracks) {
      const d = tt <= 0 ? tr.startD : tt >= 1 ? tr.endD : tr.interp(tt);
      tr.pathEl.setAttribute('d', d);

      const fill = lerpColor(tr.startFill, tr.endFill, tt) ?? tr.endFill ?? tr.startFill;
      const stroke = lerpColor(tr.startStroke, tr.endStroke, tt) ?? tr.endStroke ?? tr.startStroke;

      tr.pathEl.setAttribute('fill', fill ?? 'none');
      if (stroke) tr.pathEl.setAttribute('stroke', stroke);
      else tr.pathEl.setAttribute('stroke', 'none');

      const opacity = lerp(tr.startOpacity, tr.endOpacity, tt);
      tr.pathEl.setAttribute('opacity', String(Math.max(0, Math.min(1, opacity))));
    }
  }

  function stop(): void {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function play(): void {
    if (rafId != null) return;

    const fromT = currentT;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = clamp01(elapsed / duration);
      const eased = easing(progress);
      const t = fromT + (1 - fromT) * eased;

      currentT = clamp01(t);
      render(currentT);

      if (progress < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        rafId = null;
      }
    };

    rafId = requestAnimationFrame(frame);
  }

  function pause(): void {
    stop();
  }

  function seek(t: number): void {
    currentT = clamp01(t);
    render(currentT);
  }

  function destroy(): void {
    stop();
    container.innerHTML = '';
  }

  // Initial render
  seek(0);

  return { play, pause, seek, destroy };
}
