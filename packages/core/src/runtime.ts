import type { AnimateController, AnimateSvgArgs, AnimateSvgOptions, GsapEasePreset, MatchDebugInfo, MatchDebugNode } from './types';
import { parseSvgToNodes } from './parse';
import { normalizeNodes, type NormalizedPathNode } from './normalize';
import { matchNodes } from './match';
import { createPathInterpolator } from './morph';
import { makeAppearStartPath } from './appear';
import { extractMaskClipDefs, type DefsShape } from './defs';
import {
  collectOrbitCandidates,
  orbitPoint,
  parseOrbitDir,
  parseOrbitId,
  resolveOrbitBinding,
  translatePath,
  type OrbitBinding
} from './orbit';
import { svgPathProperties } from 'svg-path-properties';
import { bboxFromPathD, parseColorToRgba, rgbaDistance, type Rgba } from './geom';
import { linear } from './easing';
import { evalBezier } from './bezier';
import { gsap } from 'gsap';

type Track = {
  pathEl: SVGPathElement;
  order: number;
  index: number;
  layer: number;
  delayMs: number;
  intraDelayMs?: number;
  groupKey?: string;
  groupDelayMs?: number;
  startD: string;
  endD: string;
  interp: (t: number) => string;
  importance: number;
  startFill: string | undefined;
  endFill: string | undefined;
  startStroke: string | undefined;
  endStroke: string | undefined;
  startStrokeWidth?: number;
  endStrokeWidth?: number;
  startStrokeOpacity?: number;
  endStrokeOpacity?: number;
  startFillOpacity?: number;
  endFillOpacity?: number;
  startOpacity: number;
  endOpacity: number;
  dashLength?: number;
  baseAttrs?: Record<string, string>;
  startAttrs?: Record<string, string>;
  endAttrs?: Record<string, string>;
  orbit?: OrbitBinding;
};

type DefTrack = {
  pathEl: SVGPathElement;
  startD: string;
  endD: string;
  interp: (t: number) => string;
  startFill: string | undefined;
  endFill: string | undefined;
  startStroke: string | undefined;
  endStroke: string | undefined;
  startStrokeWidth?: number;
  endStrokeWidth?: number;
  startStrokeOpacity?: number;
  endStrokeOpacity?: number;
  startFillOpacity?: number;
  endFillOpacity?: number;
  startOpacity: number;
  endOpacity: number;
  baseAttrs?: Record<string, string>;
};

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpOptional(a: number | undefined, b: number | undefined, t: number): number | undefined {
  if (a == null && b == null) return undefined;
  if (a == null) return b;
  if (b == null) return a;
  return lerp(a, b, t);
}

function parseNumberAttr(attrs: Record<string, string> | undefined, key: string): number | undefined {
  if (!attrs) return undefined;
  const raw = attrs[key];
  if (raw == null || raw === '') return undefined;
  const n = Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : undefined;
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

function resolveGsapEase(preset: GsapEasePreset | undefined): string {
  switch (preset) {
    case 'slow-in-fast-out':
      return 'power3.in';
    case 'symmetric':
      return 'power2.inOut';
    case 'fast-out-slow-in':
    default:
      return 'power3.out';
  }
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function applyMotionProfile(t: number, importance: number, profile: string | undefined): number {
  if (!profile || profile === 'uniform') return t;
  const w = clamp01(importance);
  if (profile === 'focus-first') {
    return lerp(t, easeOutCubic(t), w);
  }
  if (profile === 'detail-first') {
    return lerp(t, easeInCubic(t), w);
  }
  return t;
}

function resolvePropertyTiming(t: number, mode: string | undefined): { shape: number; color: number; opacity: number; stroke: number } {
  const clamped = clamp01(t);
  if (!mode || mode === 'balanced') {
    return { shape: clamped, color: clamped, opacity: clamped, stroke: clamped };
  }
  if (mode === 'shape-first') {
    return {
      shape: clamped,
      color: clamp01(clamped * 0.6),
      opacity: clamp01(clamped * 1.1),
      stroke: clamp01(clamped * 0.7)
    };
  }
  if (mode === 'color-lag') {
    return {
      shape: clamp01(clamped * 0.9),
      color: clamp01(clamped * 0.5),
      opacity: clamp01(clamped * 1.05),
      stroke: clamp01(clamped * 0.6)
    };
  }
  return { shape: clamped, color: clamped, opacity: clamped, stroke: clamped };
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

function toDebugNode(n: NormalizedPathNode): MatchDebugNode {
  const b = bboxFromPathD(n.d);
  return {
    id: n.id,
    tag: n.tag,
    order: n.order,
    classList: n.classList,
    pathKey: n.pathKey,
    fill: n.fill,
    stroke: n.stroke,
    bbox: { cx: b.cx, cy: b.cy, width: b.width, height: b.height, area: b.area }
  };
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

function resolveGroupKey(n: NormalizedPathNode, strategy: string | undefined): string {
  if (strategy === 'pathKey') {
    return n.pathKey ? `path:${n.pathKey}` : `tag:${n.tag}`;
  }
  if (strategy === 'class') {
    const cls = n.classList && n.classList.length ? n.classList[0] : '';
    return cls ? `class:${cls}` : (n.pathKey ? `path:${n.pathKey}` : `tag:${n.tag}`);
  }
  if (n.pathKey) return `path:${n.pathKey}`;
  const cls = n.classList && n.classList.length ? n.classList[0] : '';
  if (cls) return `class:${cls}`;
  return `tag:${n.tag}`;
}

function deriveMaxSegmentLength(options?: AnimateSvgOptions): number {
  const samplePoints = options?.samplePoints;
  if (!samplePoints || !Number.isFinite(samplePoints)) return 2;
  // Heuristic: more points => smaller segments.
  const v = 200 / Math.max(8, samplePoints);
  return Math.max(0.5, Math.min(10, v));
}

const STATIC_ATTRS = [
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
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

function rewriteDefRef(value: string | undefined, map: Map<string, string>): string | undefined {
  if (!value) return undefined;
  const match = value.match(/url\\(#([^)]+)\\)/);
  if (!match) return value;
  const id = match[1]!;
  const next = map.get(id);
  if (!next) return value;
  return `url(#${next})`;
}

function applyDefAttrs(el: SVGElement, attrs: Record<string, string> | undefined): void {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'id') continue;
    if (value != null) el.setAttribute(key, value);
  }
}

export function createAnimator(args: AnimateSvgArgs): AnimateController {
  const { container } = args;
  const options = args.options;
  const duration = options?.duration ?? 600;
  const easing = options?.easing ?? linear;
  const onProgress = options?.onProgress;
  const notifyProgress = (p: number) => {
    if (onProgress) onProgress(clamp01(p));
  };

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
  const intraStagger = Math.max(0, options?.intraStagger ?? 18);
  const orbitMode = options?.orbitMode ?? 'auto+manual';
  const orbitDirection = options?.orbitDirection ?? 'shortest';
  const orbitTolerance = Math.max(0, options?.orbitTolerance ?? 6);
  const orbitDebug = options?.orbitDebug ?? false;
  const orbitSnap = options?.orbitSnap ?? true;
  const motionProfile = options?.motionProfile ?? 'uniform';
  const propertyTiming = options?.propertyTiming ?? 'balanced';
  const propertyCurves = options?.propertyCurves;
  const groupStagger = Math.max(0, options?.groupStagger ?? 0);
  const groupStrategy = options?.groupStrategy ?? 'auto';
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
  if (options?.onMatchComputed) {
    const info: MatchDebugInfo = {
      pairs: match.pairs.map((p) => ({
        start: toDebugNode(p.start),
        end: toDebugNode(p.end),
        cost: p.cost
      })),
      unmatchedStart: match.unmatchedStart.map(toDebugNode),
      unmatchedEnd: match.unmatchedEnd.map(toDebugNode)
    };
    options.onMatchComputed(info);
  }

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

  const defsStart = args.startSvg ? extractMaskClipDefs(args.startSvg) : { masks: new Map(), clips: new Map() };
  const defsEnd = extractMaskClipDefs(args.endSvg);
  const clipIdMap = new Map<string, string>();
  const maskIdMap = new Map<string, string>();
  const defTracks: DefTrack[] = [];
  let defCounter = 0;

  const animatedDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(animatedDefs);

  const buildDefTracks = (startNodes: NormalizedPathNode[], endNodes: NormalizedPathNode[]): Omit<DefTrack, 'pathEl'>[] => {
    const out: Omit<DefTrack, 'pathEl'>[] = [];
    const defMatch = matchNodes(startNodes, endNodes, options?.matchWeights);
    const appearStyle = options?.appearStyle ?? 'collapse-to-centroid';

    for (const p of defMatch.pairs) {
      const startD = p.start.d;
      const endD = p.end.d;
      const isClosed = isClosedPath(startD) && isClosedPath(endD);
      out.push({
        startD,
        endD,
        interp: createPathInterpolator(startD, endD, {
          maxSegmentLength,
          closed: isClosed,
          engine: options?.morphEngine
        }),
        startFill: p.start.fill,
        endFill: p.end.fill,
        startStroke: p.start.stroke,
        endStroke: p.end.stroke,
        startStrokeWidth: parseNumberAttr(p.start.attrs, 'stroke-width'),
        endStrokeWidth: parseNumberAttr(p.end.attrs, 'stroke-width'),
        startStrokeOpacity: parseNumberAttr(p.start.attrs, 'stroke-opacity'),
        endStrokeOpacity: parseNumberAttr(p.end.attrs, 'stroke-opacity'),
        startFillOpacity: parseNumberAttr(p.start.attrs, 'fill-opacity'),
        endFillOpacity: parseNumberAttr(p.end.attrs, 'fill-opacity'),
        startOpacity: p.start.opacity ?? 1,
        endOpacity: p.end.opacity ?? 1,
        baseAttrs: p.end.attrs
      });
    }

    for (const e of defMatch.unmatchedEnd) {
      const startD = makeAppearStartPath(e.d, { style: appearStyle });
      const isClosed = isClosedPath(startD) && isClosedPath(e.d);
      out.push({
        startD,
        endD: e.d,
        interp: createPathInterpolator(startD, e.d, { maxSegmentLength, closed: isClosed, engine: options?.morphEngine }),
        startFill: e.fill,
        endFill: e.fill,
        startStroke: e.stroke,
        endStroke: e.stroke,
        startStrokeWidth: parseNumberAttr(e.attrs, 'stroke-width'),
        endStrokeWidth: parseNumberAttr(e.attrs, 'stroke-width'),
        startStrokeOpacity: parseNumberAttr(e.attrs, 'stroke-opacity'),
        endStrokeOpacity: parseNumberAttr(e.attrs, 'stroke-opacity'),
        startFillOpacity: parseNumberAttr(e.attrs, 'fill-opacity'),
        endFillOpacity: parseNumberAttr(e.attrs, 'fill-opacity'),
        startOpacity: 0,
        endOpacity: e.opacity ?? 1,
        baseAttrs: e.attrs
      });
    }

    for (const s of defMatch.unmatchedStart) {
      const endD = makeAppearStartPath(s.d, { style: 'collapse-to-centroid' });
      const isClosed = isClosedPath(s.d) && isClosedPath(endD);
      out.push({
        startD: s.d,
        endD,
        interp: createPathInterpolator(s.d, endD, { maxSegmentLength, closed: isClosed, engine: options?.morphEngine }),
        startFill: s.fill,
        endFill: s.fill,
        startStroke: s.stroke,
        endStroke: s.stroke,
        startStrokeWidth: parseNumberAttr(s.attrs, 'stroke-width'),
        endStrokeWidth: parseNumberAttr(s.attrs, 'stroke-width'),
        startStrokeOpacity: parseNumberAttr(s.attrs, 'stroke-opacity'),
        endStrokeOpacity: parseNumberAttr(s.attrs, 'stroke-opacity'),
        startFillOpacity: parseNumberAttr(s.attrs, 'fill-opacity'),
        endFillOpacity: parseNumberAttr(s.attrs, 'fill-opacity'),
        startOpacity: s.opacity ?? 1,
        endOpacity: 0,
        baseAttrs: s.attrs
      });
    }

    return out;
  };

  const renderAnimatedDef = (kind: 'clipPath' | 'mask', id: string, startDef?: DefsShape, endDef?: DefsShape) => {
    const newId = `__ssa_${kind}_${id}_${defCounter++}`;
    const defEl = document.createElementNS('http://www.w3.org/2000/svg', kind);
    defEl.setAttribute('id', newId);
    applyDefAttrs(defEl, endDef?.attrs ?? startDef?.attrs);
    animatedDefs.appendChild(defEl);

    const startNodes = startDef?.nodes ?? [];
    const endNodes = endDef?.nodes ?? [];
    const inits = buildDefTracks(startNodes, endNodes);
    for (const init of inits) {
      const pathEl = mkPathEl();
      applyStaticAttributes(pathEl, init.baseAttrs);
      defEl.appendChild(pathEl);
      defTracks.push({ ...init, pathEl });
    }

    return newId;
  };

  const clipIds = new Set<string>([...defsStart.clips.keys(), ...defsEnd.clips.keys()]);
  for (const id of clipIds) {
    const newId = renderAnimatedDef('clipPath', id, defsStart.clips.get(id), defsEnd.clips.get(id));
    clipIdMap.set(id, newId);
  }

  const maskIds = new Set<string>([...defsStart.masks.keys(), ...defsEnd.masks.keys()]);
  for (const id of maskIds) {
    const newId = renderAnimatedDef('mask', id, defsStart.masks.get(id), defsEnd.masks.get(id));
    maskIdMap.set(id, newId);
  }

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
      const bgClip = rewriteDefRef(n.attrs['clip-path'], clipIdMap);
      if (bgClip) pathEl.setAttribute('clip-path', bgClip);
      const bgMask = rewriteDefRef(n.attrs['mask'], maskIdMap);
      if (bgMask) pathEl.setAttribute('mask', bgMask);
      const fillAttr = n.fill ?? 'none';
      pathEl.setAttribute('fill', fillAttr);
      pathEl.setAttribute('stroke', n.stroke ?? 'none');
      if (n.attrs['stroke-width']) pathEl.setAttribute('stroke-width', n.attrs['stroke-width']);
      if (n.attrs['stroke-opacity']) pathEl.setAttribute('stroke-opacity', n.attrs['stroke-opacity']);
      if (n.attrs['fill-opacity']) pathEl.setAttribute('fill-opacity', n.attrs['fill-opacity']);
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
    const clipRef = rewriteDefRef(p.end.attrs['clip-path'], clipIdMap);
    if (clipRef) pathEl.setAttribute('clip-path', clipRef);
    const maskRef = rewriteDefRef(p.end.attrs['mask'], maskIdMap);
    if (maskRef) pathEl.setAttribute('mask', maskRef);

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
    const importance = clamp01(layerOverall.area > 0 ? (bboxFromPathD(p.end.d).area || 0) / layerOverall.area : 0);
    const startStrokeWidth = parseNumberAttr(p.start.attrs, 'stroke-width');
    const endStrokeWidth = parseNumberAttr(p.end.attrs, 'stroke-width');
    const startStrokeOpacity = parseNumberAttr(p.start.attrs, 'stroke-opacity');
    const endStrokeOpacity = parseNumberAttr(p.end.attrs, 'stroke-opacity');
    const startFillOpacity = parseNumberAttr(p.start.attrs, 'fill-opacity');
    const endFillOpacity = parseNumberAttr(p.end.attrs, 'fill-opacity');

    tracks.push({
      pathEl,
      order: p.end.order,
      index: trackIndex++,
      layer,
      delayMs,
      groupKey: resolveGroupKey(p.end, groupStrategy),
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
      importance,
      startStrokeWidth,
      endStrokeWidth,
      startStrokeOpacity,
      endStrokeOpacity,
      startFillOpacity,
      endFillOpacity,
      startOpacity: p.start.opacity ?? 1,
      endOpacity: p.end.opacity ?? 1,
      dashLength,
      baseAttrs: p.end.attrs,
      startAttrs: p.start.attrs,
      endAttrs: p.end.attrs
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
    const clipRef = rewriteDefRef(e.attrs['clip-path'], clipIdMap);
    if (clipRef) pathEl.setAttribute('clip-path', clipRef);
    const maskRef = rewriteDefRef(e.attrs['mask'], maskIdMap);
    if (maskRef) pathEl.setAttribute('mask', maskRef);

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
    const importance = clamp01(layerOverall.area > 0 ? (bboxFromPathD(e.d).area || 0) / layerOverall.area : 0);
    const strokeWidth = parseNumberAttr(e.attrs, 'stroke-width');
    const strokeOpacity = parseNumberAttr(e.attrs, 'stroke-opacity');
    const fillOpacity = parseNumberAttr(e.attrs, 'fill-opacity');

    tracks.push({
      pathEl,
      order: e.order,
      index: trackIndex++,
      layer,
      delayMs,
      groupKey: resolveGroupKey(e, groupStrategy),
      startD,
      endD: e.d,
      interp: shouldDash
        ? () => e.d
        : createPathInterpolator(startD, e.d, { maxSegmentLength, closed: isClosed, engine: options?.morphEngine }),
      startFill: e.fill,
      endFill: e.fill,
      startStroke: e.stroke,
      endStroke: e.stroke,
      importance,
      startStrokeWidth: strokeWidth,
      endStrokeWidth: strokeWidth,
      startStrokeOpacity: strokeOpacity,
      endStrokeOpacity: strokeOpacity,
      startFillOpacity: fillOpacity,
      endFillOpacity: fillOpacity,
      startOpacity: 0,
      endOpacity: e.opacity ?? 1,
      dashLength,
      baseAttrs: e.attrs,
      startAttrs: e.attrs,
      endAttrs: e.attrs
    });
  }

  // Start-only: disappear
  for (const s of match.unmatchedStart) {
    const endD = makeAppearStartPath(s.d, { style: 'collapse-to-centroid' });

    const pathEl = mkPathEl();

    applyStaticAttributes(pathEl, s.attrs);
    const clipRef = rewriteDefRef(s.attrs['clip-path'], clipIdMap);
    if (clipRef) pathEl.setAttribute('clip-path', clipRef);
    const maskRef = rewriteDefRef(s.attrs['mask'], maskIdMap);
    if (maskRef) pathEl.setAttribute('mask', maskRef);

    const isClosed = isClosedPath(s.d) && isClosedPath(endD);
    const layer = layerForNode(s);
    const delayMs = layer * layerStagger;
    const importance = clamp01(layerOverall.area > 0 ? (bboxFromPathD(s.d).area || 0) / layerOverall.area : 0);
    const strokeWidth = parseNumberAttr(s.attrs, 'stroke-width');
    const strokeOpacity = parseNumberAttr(s.attrs, 'stroke-opacity');
    const fillOpacity = parseNumberAttr(s.attrs, 'fill-opacity');

    tracks.push({
      pathEl,
      order: s.order,
      index: trackIndex++,
      layer,
      delayMs,
      groupKey: resolveGroupKey(s, groupStrategy),
      startD: s.d,
      endD,
      interp: createPathInterpolator(s.d, endD, { maxSegmentLength, closed: isClosed, engine: options?.morphEngine }),
      startFill: s.fill,
      endFill: s.fill,
      startStroke: s.stroke,
      endStroke: s.stroke,
      importance,
      startStrokeWidth: strokeWidth,
      endStrokeWidth: strokeWidth,
      startStrokeOpacity: strokeOpacity,
      endStrokeOpacity: strokeOpacity,
      startFillOpacity: fillOpacity,
      endFillOpacity: fillOpacity,
      startOpacity: s.opacity ?? 1,
      endOpacity: 0,
      baseAttrs: s.attrs,
      startAttrs: s.attrs,
      endAttrs: s.attrs
    });
  }

  const orbitSource = endNodes.length ? endNodes : startNodes;
  const orbitCandidates = (orbitMode !== 'off' || orbitDebug) ? collectOrbitCandidates(orbitSource) : [];

  if (orbitMode !== 'off' && orbitCandidates.length) {
    for (const tr of tracks) {
      const startBox = bboxFromPathD(tr.startD);
      const endBox = bboxFromPathD(tr.endD);
      const manualId = parseOrbitId(tr.endAttrs?.['data-orbit'] ?? tr.startAttrs?.['data-orbit']);
      const manualDir = parseOrbitDir(tr.endAttrs?.['data-orbit-dir'] ?? tr.startAttrs?.['data-orbit-dir']);

      const binding = resolveOrbitBinding({
        mode: orbitMode,
        direction: orbitDirection,
        tolerance: orbitTolerance,
        snap: orbitSnap,
        manualId,
        manualDir,
        candidates: orbitCandidates,
        startCenter: { x: startBox.cx, y: startBox.cy },
        endCenter: { x: endBox.cx, y: endBox.cy }
      });

      if (binding) tr.orbit = binding;
    }
  }

  if (orbitDebug && orbitCandidates.length) {
    const matched = new Set(tracks.filter((t) => t.orbit).map((t) => t.orbit!.candidate.id));
    const debugGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    debugGroup.setAttribute('data-orbit-debug', 'true');
    debugGroup.setAttribute('pointer-events', 'none');

    for (const cand of orbitCandidates) {
      const p = mkPathEl();
      p.setAttribute('d', cand.d);
      p.setAttribute('fill', 'none');
      p.setAttribute('vector-effect', 'non-scaling-stroke');

      const hit = matched.has(cand.id);
      p.setAttribute('stroke', hit ? '#00FFC2' : '#FFFFFF');
      p.setAttribute('stroke-width', hit ? '1.6' : '1');
      p.setAttribute('stroke-dasharray', hit ? '4 3' : '2 3');
      p.setAttribute('opacity', hit ? '0.9' : '0.4');
      debugGroup.appendChild(p);
    }

    svg.appendChild(debugGroup);
  }

  if (intraStagger > 0) {
    const layerGroups = new Map<number, Track[]>();
    for (const tr of tracks) {
      const list = layerGroups.get(tr.layer) || [];
      list.push(tr);
      layerGroups.set(tr.layer, list);
    }

    for (const group of layerGroups.values()) {
      group.sort((a, b) => (a.order - b.order) || (a.index - b.index));
      group.forEach((tr, i) => {
        tr.intraDelayMs = i * intraStagger;
      });
    }
  }

  if (groupStagger > 0) {
    const groups = new Map<string, Track[]>();
    for (const tr of tracks) {
      const key = tr.groupKey || 'default';
      const list = groups.get(key) || [];
      list.push(tr);
      groups.set(key, list);
    }

    const entries = Array.from(groups.entries()).map(([key, list]) => {
      const minOrder = Math.min(...list.map((t) => t.order));
      return { key, list, minOrder };
    });
    entries.sort((a, b) => (a.minOrder - b.minOrder) || a.key.localeCompare(b.key));

    entries.forEach((entry, idx) => {
      const delay = idx * groupStagger;
      entry.list.forEach((tr) => {
        tr.groupDelayMs = delay;
      });
    });
  }

  // Preserve original drawing order to avoid background shapes covering details.
  const ordered = [...tracks].sort((a, b) => (a.order - b.order) || (a.index - b.index));
  for (const tr of ordered) svg.appendChild(tr.pathEl);

  const maxDelay = tracks.reduce((m, t) => Math.max(m, t.delayMs + (t.intraDelayMs ?? 0)), 0);
  const totalDuration = Math.max(1, duration + maxDelay);

  let rafId: number | null = null;
  let currentP = 0;
  const driver = options?.timeline ?? 'raf';
  let gsapTimeline: gsap.core.Timeline | null = null;

  function renderTrack(tr: Track, local: number): void {
    const t = clamp01(local);
    const base = applyMotionProfile(t, tr.importance, motionProfile);
    const timing = resolvePropertyTiming(base, propertyTiming);
    const tShape = propertyCurves?.shape ? evalBezier(base, propertyCurves.shape) : timing.shape;
    const tColor = propertyCurves?.color ? evalBezier(base, propertyCurves.color) : timing.color;
    const tOpacity = propertyCurves?.opacity ? evalBezier(base, propertyCurves.opacity) : timing.opacity;
    const tStroke = propertyCurves?.stroke ? evalBezier(base, propertyCurves.stroke) : timing.stroke;

    let d = tShape <= 0 ? tr.startD : tShape >= 1 ? tr.endD : tr.interp(tShape);

    if (tr.orbit) {
      const box = bboxFromPathD(d);
      const p = orbitPoint(tr.orbit, tShape);
      d = translatePath(d, p.x - box.cx, p.y - box.cy);
    }

    tr.pathEl.setAttribute('d', d);

    const fill = lerpColor(tr.startFill, tr.endFill, tColor) ?? tr.endFill ?? tr.startFill;
    const stroke = lerpColor(tr.startStroke, tr.endStroke, tColor) ?? tr.endStroke ?? tr.startStroke;

    // If both fill and stroke are omitted, SVG defaults to black fill. We only apply this default
    // when BOTH are missing to avoid accidentally filling stroke-only icons.
    const fillAttr = fill === undefined && stroke === undefined ? '#000000' : (fill ?? 'none');
    tr.pathEl.setAttribute('fill', fillAttr);
    tr.pathEl.setAttribute('stroke', stroke ?? 'none');

    if (tr.dashLength !== undefined && stroke) {
      const dash = tr.dashLength;
      tr.pathEl.setAttribute('stroke-dasharray', String(dash));
      tr.pathEl.setAttribute('stroke-dashoffset', String(lerp(dash, 0, tShape)));
    }

    const strokeWidth = lerpOptional(tr.startStrokeWidth, tr.endStrokeWidth, tStroke);
    if (strokeWidth != null) tr.pathEl.setAttribute('stroke-width', String(strokeWidth));

    const strokeOpacity = lerpOptional(tr.startStrokeOpacity, tr.endStrokeOpacity, tStroke);
    if (strokeOpacity != null) tr.pathEl.setAttribute('stroke-opacity', String(clamp01(strokeOpacity)));

    const fillOpacity = lerpOptional(tr.startFillOpacity, tr.endFillOpacity, tOpacity);
    if (fillOpacity != null) tr.pathEl.setAttribute('fill-opacity', String(clamp01(fillOpacity)));

    const opacity = lerp(tr.startOpacity, tr.endOpacity, tOpacity);
    tr.pathEl.setAttribute('opacity', String(Math.max(0, Math.min(1, opacity))));
  }

  function renderDefTrack(tr: DefTrack, local: number): void {
    const t = clamp01(local);
    const d = t <= 0 ? tr.startD : t >= 1 ? tr.endD : tr.interp(t);
    tr.pathEl.setAttribute('d', d);

    const fill = lerpColor(tr.startFill, tr.endFill, t) ?? tr.endFill ?? tr.startFill;
    const stroke = lerpColor(tr.startStroke, tr.endStroke, t) ?? tr.endStroke ?? tr.startStroke;
    const fillAttr = fill === undefined && stroke === undefined ? '#000000' : (fill ?? 'none');
    tr.pathEl.setAttribute('fill', fillAttr);
    tr.pathEl.setAttribute('stroke', stroke ?? 'none');

    const strokeWidth = lerpOptional(tr.startStrokeWidth, tr.endStrokeWidth, t);
    if (strokeWidth != null) tr.pathEl.setAttribute('stroke-width', String(strokeWidth));

    const strokeOpacity = lerpOptional(tr.startStrokeOpacity, tr.endStrokeOpacity, t);
    if (strokeOpacity != null) tr.pathEl.setAttribute('stroke-opacity', String(clamp01(strokeOpacity)));

    const fillOpacity = lerpOptional(tr.startFillOpacity, tr.endFillOpacity, t);
    if (fillOpacity != null) tr.pathEl.setAttribute('fill-opacity', String(clamp01(fillOpacity)));

    const opacity = lerp(tr.startOpacity, tr.endOpacity, t);
    tr.pathEl.setAttribute('opacity', String(Math.max(0, Math.min(1, opacity))));
  }

  function renderProgress(p: number): void {
    const eased = easing(clamp01(p));
    const time = eased * totalDuration;

    for (const tr of defTracks) {
      renderDefTrack(tr, eased);
    }

    for (const tr of tracks) {
      const delay = tr.delayMs + (tr.groupDelayMs ?? 0) + (tr.intraDelayMs ?? 0);
      const local = clamp01((time - delay) / duration);
      renderTrack(tr, local);
    }

    notifyProgress(p);
  }

  function renderGsapProgress(p: number): void {
    const time = clamp01(p) * totalDuration;
    const easeFn = gsap.parseEase(resolveGsapEase(options?.gsapEasePreset));
    const easedGlobal = easeFn(clamp01(p));

    for (const tr of defTracks) {
      renderDefTrack(tr, easedGlobal);
    }

    for (const tr of tracks) {
      const delay = tr.delayMs + (tr.groupDelayMs ?? 0) + (tr.intraDelayMs ?? 0);
      const local = clamp01((time - delay) / duration);
      const easedLocal = easeFn(local);
      renderTrack(tr, easedLocal);
    }

    notifyProgress(p);
  }

  function stop(): void {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (gsapTimeline) {
      gsapTimeline.pause();
    }
  }

  function ensureGsap(): void {
    if (gsapTimeline) return;
    const ease = resolveGsapEase(options?.gsapEasePreset);
    gsapTimeline = gsap.timeline({ paused: true });
    gsapTimeline.eventCallback('onUpdate', () => {
      notifyProgress(gsapTimeline!.progress());
    });

    for (const tr of tracks) {
      const delay = tr.delayMs + (tr.intraDelayMs ?? 0);
      const local = { t: 0 };
      gsapTimeline.to(
        local,
        {
          t: 1,
          duration: duration / 1000,
          ease,
          onUpdate: () => renderTrack(tr, local.t)
        },
        delay / 1000
      );
    }
  }

  function play(): void {
    if (driver === 'gsap') {
      ensureGsap();
      gsapTimeline!.play();
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
      gsapTimeline!.progress(currentP).pause();
      renderGsapProgress(currentP);
      return;
    }
    renderProgress(currentP);
  }

  function destroy(): void {
    stop();
    if (gsapTimeline) {
      gsapTimeline.kill();
      gsapTimeline = null;
    }
    container.innerHTML = '';
  }

  // Initial render
  seek(0);

  return { play, pause, seek, destroy };
}
