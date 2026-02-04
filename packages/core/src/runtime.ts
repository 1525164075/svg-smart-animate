import type { AnimateController, AnimateSvgArgs, AnimateSvgOptions } from './types';
import { parseSvgToNodes } from './parse';
import { normalizeNodes, type NormalizedPathNode } from './normalize';
import { matchNodes } from './match';
import { createPathInterpolator } from './morph';
import { makeAppearStartPath } from './appear';
import { svgPathProperties } from 'svg-path-properties';
import { bboxFromPathD, parseColorToRgba, type Rgba } from './geom';
import { linear } from './easing';
import { gsap } from 'gsap';

type Track = {
  pathEl: SVGPathElement;
  order: number;
  index: number;
  layer: number;
  delayMs: number;
  startD: string;
  endD: string;
  interp: (t: number) => string;
  startFill: string | undefined;
  endFill: string | undefined;
  startStroke: string | undefined;
  endStroke: string | undefined;
  startOpacity: number;
  endOpacity: number;
  dashLength?: number;
  baseAttrs?: Record<string, string>;
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

function computeBBox(nodes: NormalizedPathNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  area: number;
} {
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
  return { minX, minY, maxX, maxY, width, height, area: width * height };
}

const LAYER_COUNT = 3;

function layerIndexByRatio(ratio: number): number {
  if (ratio > 0.35) return 0;
  if (ratio > 0.12) return 1;
  return 2;
}

function layerIndexByOrder(order: number, min: number, max: number): number {
  const t = (order - min) / (max - min || 1);
  if (t < 1 / 3) return 0;
  if (t < 2 / 3) return 1;
  return 2;
}

function deriveMaxSegmentLength(options?: AnimateSvgOptions): number {
  const samplePoints = options?.samplePoints;
  if (!samplePoints || !Number.isFinite(samplePoints)) return 2;
  // Heuristic: more points => smaller segments.
  const v = 200 / Math.max(8, samplePoints);
  return Math.max(0.5, Math.min(10, v));
}

const STATIC_ATTRS = [
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'fill-opacity',
  'fill-rule',
  'shape-rendering',
  'vector-effect',
  'clip-path',
  'mask',
  'filter',
  'stroke-dasharray',
  'stroke-dashoffset'
];

function applyStaticAttributes(el: SVGPathElement, attrs: Record<string, string> | undefined): void {
  if (!attrs) return;
  for (const key of STATIC_ATTRS) {
    const value = attrs[key];
    if (value !== undefined) el.setAttribute(key, value);
  }
}

function isClosedPath(d: string): boolean {
  return /[zZ]\s*$/.test(d.trim());
}

function isBackgroundNode(n: NormalizedPathNode, overall: ReturnType<typeof computeBBox>): boolean {
  if (n.tag !== 'rect') return false;
  if (!n.fill || n.fill === 'none') return false;
  if (n.stroke && n.stroke !== 'none') return false;
  if (overall.area <= 0) return false;

  const b = bboxFromPathD(n.d);
  const areaRatio = (b.area || 0) / overall.area;
  return areaRatio >= 0.9;
}

function detectBackgroundLayers(nodes: NormalizedPathNode[]): { background: NormalizedPathNode[]; foreground: NormalizedPathNode[] } {
  const overall = computeBBox(nodes);
  if (overall.area <= 0) return { background: [], foreground: nodes };

  let mainBg: NormalizedPathNode | null = null;
  let mainRatio = 0;

  for (const n of nodes) {
    if (n.tag !== 'rect') continue;
    if (!n.fill || n.fill === 'none') continue;
    if (n.stroke && n.stroke !== 'none') continue;
    const b = bboxFromPathD(n.d);
    const ratio = (b.area || 0) / overall.area;
    if (ratio > mainRatio) {
      mainRatio = ratio;
      mainBg = n;
    }
  }

  const background: NormalizedPathNode[] = [];
  const foreground: NormalizedPathNode[] = [];

  const mainColor = mainBg ? parseColorToRgba(mainBg.fill) : null;
  const colorTol = 0.08; // ~20/255 per channel

  for (const n of nodes) {
    if (mainBg && n === mainBg && mainRatio >= 0.9) {
      background.push(n);
      continue;
    }

    if (
      mainColor &&
      n.tag === 'rect' &&
      n.fill &&
      n.fill !== 'none' &&
      (!n.stroke || n.stroke === 'none')
    ) {
      const b = bboxFromPathD(n.d);
      const ratio = (b.area || 0) / overall.area;
      const c = parseColorToRgba(n.fill);
      if (ratio >= 0.02 && c && rgbaDistance(mainColor, c) <= colorTol) {
        background.push(n);
        continue;
      }
    }

    foreground.push(n);
  }

  return { background, foreground };
}

function extractViewBox(svgText: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    const vb = svg?.getAttribute('viewBox');
    return vb ? vb.trim() : null;
  } catch {
    return null;
  }
}

function extractDefs(svgText: string): SVGDefsElement | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const defs = doc.querySelector('defs');
    if (!defs) return null;
    return document.importNode(defs, true) as SVGDefsElement;
  } catch {
    return null;
  }
}

export function createAnimator(args: AnimateSvgArgs): AnimateController {
  const { container } = args;
  const options = args.options;
  const duration = options?.duration ?? 600;
  const easing = options?.easing ?? linear;

  const endRaw = parseSvgToNodes(args.endSvg);
  const endNodes = normalizeNodes(endRaw);

  const isAppearMode = !args.startSvg;
  let startNodes: NormalizedPathNode[] = [];
  let animEndNodes = endNodes;
  let backgroundNodes: NormalizedPathNode[] = [];

  if (isAppearMode) {
    const detected = detectBackgroundLayers(endNodes);
    backgroundNodes = detected.background;
    animEndNodes = detected.foreground;
    const style = options?.appearStyle ?? 'collapse-to-centroid';
    startNodes = animEndNodes.map((n) => ({
      ...n,
      d: makeAppearStartPath(n.d, { style }),
      opacity: 0
    }));
  } else {
    const startRaw = parseSvgToNodes(args.startSvg!);
    startNodes = normalizeNodes(startRaw);

    const overallEnd = computeBBox(endNodes);
    const endBackground = endNodes.filter((n) => isBackgroundNode(n, overallEnd));
    const overallStart = computeBBox(startNodes);
    const startBackground = startNodes.filter((n) => isBackgroundNode(n, overallStart));

    if (endBackground.length || startBackground.length) {
      backgroundNodes = endBackground.length ? endBackground : startBackground;
      animEndNodes = endNodes.filter((n) => !endBackground.includes(n));
      startNodes = startNodes.filter((n) => !startBackground.includes(n));
    }
  }

  const layerStrategy = options?.layerStrategy ?? 'area';
  const layerStagger = Math.max(0, options?.layerStagger ?? 70);
  const layerOverall = computeBBox(animEndNodes.length ? animEndNodes : startNodes);
  const orders = (animEndNodes.length ? animEndNodes : startNodes).map((n) => n.order);
  const orderMin = orders.length ? Math.min(...orders) : 0;
  const orderMax = orders.length ? Math.max(...orders) : 1;

  const layerForNode = (n: NormalizedPathNode): number => {
    if (layerStrategy === 'order') return layerIndexByOrder(n.order, orderMin, orderMax);
    if (layerOverall.area <= 0) return 1;
    const b = bboxFromPathD(n.d);
    const ratio = (b.area || 0) / layerOverall.area;
    return layerIndexByRatio(ratio);
  };

  // Build tracks: matched pairs + appear/disappear fallbacks.
  const match = matchNodes(startNodes, animEndNodes, options?.matchWeights);

  // Reset container.
  container.innerHTML = '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const defs = extractDefs(args.endSvg);
  if (defs) svg.appendChild(defs);

  const explicitViewBox = extractViewBox(args.endSvg) ?? (args.startSvg ? extractViewBox(args.startSvg) : null);
  if (explicitViewBox) {
    svg.setAttribute('viewBox', explicitViewBox);
  } else {
    const vbFrom = endNodes.length ? endNodes : startNodes;
    const vb = computeViewBox(vbFrom);
    svg.setAttribute('viewBox', `${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`);
  }

  container.appendChild(svg);

  const maxSegmentLength = deriveMaxSegmentLength(options);

  const tracks: Track[] = [];
  let trackIndex = 0;

  function mkPathEl(): SVGPathElement {
    return document.createElementNS('http://www.w3.org/2000/svg', 'path');
  }

  if (backgroundNodes.length) {
    const orderedBg = [...backgroundNodes].sort((a, b) => a.order - b.order);
    for (const n of orderedBg) {
      const pathEl = mkPathEl();
      pathEl.setAttribute('d', n.d);
      applyStaticAttributes(pathEl, n.attrs);
      const fillAttr = n.fill ?? 'none';
      pathEl.setAttribute('fill', fillAttr);
      pathEl.setAttribute('stroke', n.stroke ?? 'none');
      if (n.opacity != null) pathEl.setAttribute('opacity', String(n.opacity));
      svg.appendChild(pathEl);
    }
  }

  for (const p of match.pairs) {
    const isOpenPath = !isClosedPath(p.end.d);
    const hasDashArray = p.end.attrs['stroke-dasharray'] !== undefined;
    const shouldDash =
      isAppearMode &&
      isOpenPath &&
      !hasDashArray &&
      (p.end.fill === undefined || p.end.fill === 'none') &&
      p.end.stroke;
    const startD = shouldDash ? p.end.d : p.start.d;

    const pathEl = mkPathEl();

    applyStaticAttributes(pathEl, p.end.attrs);

    let dashLength: number | undefined;
    if (shouldDash) {
      try {
        dashLength = new svgPathProperties(p.end.d).getTotalLength();
      } catch {
        try {
          dashLength = pathEl.getTotalLength ? pathEl.getTotalLength() : undefined;
        } catch {
          dashLength = undefined;
        }
      }
    }

    const isClosed = isClosedPath(startD) && isClosedPath(p.end.d);
    const layer = layerForNode(p.end);
    const delayMs = layer * layerStagger;

    tracks.push({
      pathEl,
      order: p.end.order,
      index: trackIndex++,
      layer,
      delayMs,
      startD,
      endD: p.end.d,
      interp: shouldDash
        ? () => p.end.d
        : createPathInterpolator(startD, p.end.d, {
            maxSegmentLength,
            closed: isClosed,
            engine: options?.morphEngine
          }),
      startFill: p.start.fill,
      endFill: p.end.fill,
      startStroke: p.start.stroke,
      endStroke: p.end.stroke,
      startOpacity: p.start.opacity ?? 1,
      endOpacity: p.end.opacity ?? 1,
      dashLength,
      baseAttrs: p.end.attrs
    });
  }

  // End-only: appear
  for (const e of match.unmatchedEnd) {
    const appearStyle = options?.appearStyle ?? 'collapse-to-centroid';
    const isOpenPath = !isClosedPath(e.d);
    const hasDashArray = e.attrs['stroke-dasharray'] !== undefined;
    const shouldDash =
      isOpenPath &&
      !hasDashArray &&
      (e.fill === undefined || e.fill === 'none') &&
      e.stroke;
    const startD = shouldDash ? e.d : makeAppearStartPath(e.d, { style: appearStyle });

    const pathEl = mkPathEl();

    applyStaticAttributes(pathEl, e.attrs);

    let dashLength: number | undefined;
    if (shouldDash) {
      try {
        dashLength = new svgPathProperties(e.d).getTotalLength();
      } catch {
        try {
          dashLength = pathEl.getTotalLength ? pathEl.getTotalLength() : undefined;
        } catch {
          dashLength = undefined;
        }
      }
    }

    const isClosed = isClosedPath(startD) && isClosedPath(e.d);
    const layer = layerForNode(e);
    const delayMs = layer * layerStagger;

    tracks.push({
      pathEl,
      order: e.order,
      index: trackIndex++,
      layer,
      delayMs,
      startD,
      endD: e.d,
      interp: shouldDash
        ? () => e.d
        : createPathInterpolator(startD, e.d, { maxSegmentLength, closed: isClosed, engine: options?.morphEngine }),
      startFill: e.fill,
      endFill: e.fill,
      startStroke: e.stroke,
      endStroke: e.stroke,
      startOpacity: 0,
      endOpacity: e.opacity ?? 1,
      dashLength,
      baseAttrs: e.attrs
    });
  }

  // Start-only: disappear
  for (const s of match.unmatchedStart) {
    const endD = makeAppearStartPath(s.d, { style: 'collapse-to-centroid' });

    const pathEl = mkPathEl();

    applyStaticAttributes(pathEl, s.attrs);

    const isClosed = isClosedPath(s.d) && isClosedPath(endD);
    const layer = layerForNode(s);
    const delayMs = layer * layerStagger;

    tracks.push({
      pathEl,
      order: s.order,
      index: trackIndex++,
      layer,
      delayMs,
      startD: s.d,
      endD,
      interp: createPathInterpolator(s.d, endD, { maxSegmentLength, closed: isClosed, engine: options?.morphEngine }),
      startFill: s.fill,
      endFill: s.fill,
      startStroke: s.stroke,
      endStroke: s.stroke,
      startOpacity: s.opacity ?? 1,
      endOpacity: 0,
      baseAttrs: s.attrs
    });
  }

  // Preserve original drawing order to avoid background shapes covering details.
  const ordered = [...tracks].sort((a, b) => (a.order - b.order) || (a.index - b.index));
  for (const tr of ordered) svg.appendChild(tr.pathEl);

  const maxDelay = tracks.reduce((m, t) => Math.max(m, t.delayMs), 0);
  const totalDuration = Math.max(1, duration + maxDelay);

  let rafId: number | null = null;
  let currentP = 0;
  const driver = options?.timeline ?? 'raf';
  const gsapState = { p: 0 };
  let gsapTween: gsap.core.Tween | null = null;

  function renderProgress(p: number): void {
    const eased = easing(clamp01(p));
    const time = eased * totalDuration;

    for (const tr of tracks) {
      const local = clamp01((time - tr.delayMs) / duration);
      const d = local <= 0 ? tr.startD : local >= 1 ? tr.endD : tr.interp(local);
      tr.pathEl.setAttribute('d', d);

      const fill = lerpColor(tr.startFill, tr.endFill, local) ?? tr.endFill ?? tr.startFill;
      const stroke = lerpColor(tr.startStroke, tr.endStroke, local) ?? tr.endStroke ?? tr.startStroke;

      // If both fill and stroke are omitted, SVG defaults to black fill. We only apply this default
      // when BOTH are missing to avoid accidentally filling stroke-only icons.
      const fillAttr = fill === undefined && stroke === undefined ? '#000000' : (fill ?? 'none');
      tr.pathEl.setAttribute('fill', fillAttr);
      tr.pathEl.setAttribute('stroke', stroke ?? 'none');

      if (tr.dashLength !== undefined && stroke) {
        const dash = tr.dashLength;
        tr.pathEl.setAttribute('stroke-dasharray', String(dash));
        tr.pathEl.setAttribute('stroke-dashoffset', String(lerp(dash, 0, local)));
      }

      const opacity = lerp(tr.startOpacity, tr.endOpacity, local);
      tr.pathEl.setAttribute('opacity', String(Math.max(0, Math.min(1, opacity))));
    }
  }

  function stop(): void {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (gsapTween) {
      gsapTween.pause();
    }
  }

  function ensureGsap(): void {
    if (gsapTween) return;
    gsapState.p = currentP;
    gsapTween = gsap.to(gsapState, {
      p: 1,
      duration: totalDuration / 1000,
      ease: 'none',
      paused: true,
      onUpdate: () => {
        currentP = clamp01(gsapState.p);
        renderProgress(currentP);
      }
    });
  }

  function play(): void {
    if (driver === 'gsap') {
      ensureGsap();
      gsapTween!.play();
      return;
    }

    if (rafId != null) return;
    const fromP = currentP;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = clamp01(elapsed / totalDuration);
      const p = fromP + (1 - fromP) * progress;

      currentP = clamp01(p);
      renderProgress(currentP);

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
    currentP = clamp01(t);
    if (driver === 'gsap') {
      ensureGsap();
      gsapTween!.progress(currentP).pause();
    }
    renderProgress(currentP);
  }

  function destroy(): void {
    stop();
    if (gsapTween) {
      gsapTween.kill();
      gsapTween = null;
    }
    container.innerHTML = '';
  }

  // Initial render
  seek(0);

  return { play, pause, seek, destroy };
}
