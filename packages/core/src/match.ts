import computeMunkres from 'munkres-js';
import type { MatchWeights } from './types';
import type { NormalizedPathNode } from './normalize';
import { bboxFromPathD, parseColorToRgba, rgbaDistance } from './geom';

export type MatchedPair = {
  start: NormalizedPathNode;
  end: NormalizedPathNode;
  cost: number;
};

export type MatchResult = {
  pairs: MatchedPair[];
  unmatchedStart: NormalizedPathNode[];
  unmatchedEnd: NormalizedPathNode[];
};

type NodeFeatures = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  area: number;
  fill: ReturnType<typeof parseColorToRgba>;
  pathKey?: string;
  classList?: string[];
};

const DEFAULT_WEIGHTS: Required<MatchWeights> = {
  position: 1,
  size: 0.35,
  area: 0.15,
  color: 0.3,
  length: 0,
  group: 0.25,
  class: 0.15
};

function stableKey(n: NormalizedPathNode): string | null {
  const id = n.attrs.id;
  if (id) return id;
  const name = n.attrs['data-name'];
  return name || null;
}

function styleKey(n: NormalizedPathNode): 'f' | 's' | 'fs' | 'none' {
  const hasFill = n.fill !== undefined && n.fill !== 'none';
  const hasStroke = n.stroke !== undefined && n.stroke !== 'none';
  if (hasFill && hasStroke) return 'fs';
  if (hasFill) return 'f';
  if (hasStroke) return 's';
  return 'none';
}

function groupKey(n: NormalizedPathNode): string {
  return `${n.tag}:${styleKey(n)}`;
}

function classTokens(n: NormalizedPathNode): string[] {
  if (!n.classList || n.classList.length === 0) return [];
  return n.classList.map((c) => c.trim().toLowerCase()).filter(Boolean);
}

function pathDistance(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  const as = a.split('/');
  const bs = b.split('/');
  const maxLen = Math.max(as.length, bs.length);
  let common = 0;
  for (let i = 0; i < Math.min(as.length, bs.length); i++) {
    if (as[i] !== bs[i]) break;
    common++;
  }
  return 1 - common / (maxLen || 1);
}

function classDistance(a?: string[], b?: string[]): number {
  if ((!a || a.length === 0) && (!b || b.length === 0)) return 0;
  if (!a || !b || a.length === 0 || b.length === 0) return 1;
  const setA = new Set(a.map((c) => c.toLowerCase()));
  const setB = new Set(b.map((c) => c.toLowerCase()));
  let inter = 0;
  for (const v of setA) {
    if (setB.has(v)) inter++;
  }
  const union = new Set([...setA, ...setB]).size || 1;
  return 1 - inter / union;
}

function buildFeatures(nodes: NormalizedPathNode[]): { features: NodeFeatures[]; diag: number } {
  const bboxes = nodes.map((n) => bboxFromPathD(n.d));

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const b of bboxes) {
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  const diag = Math.hypot(maxX - minX, maxY - minY) || 1;

  const features = nodes.map((n, i) => {
    const b = bboxes[i]!;
    return {
      cx: b.cx,
      cy: b.cy,
      width: b.width,
      height: b.height,
      area: b.area,
      fill: parseColorToRgba(n.fill),
      pathKey: n.pathKey,
      classList: n.classList
    };
  });

  return { features, diag };
}

function costBetween(a: NodeFeatures, b: NodeFeatures, diag: number, w: Required<MatchWeights>): number {
  const pos = Math.hypot(a.cx - b.cx, a.cy - b.cy) / diag;
  const size = Math.hypot(a.width - b.width, a.height - b.height) / diag;
  const area = Math.abs(a.area - b.area) / (Math.max(a.area, b.area, 1));
  const color = rgbaDistance(a.fill, b.fill);
  const group = pathDistance(a.pathKey, b.pathKey);
  const cls = classDistance(a.classList, b.classList);

  return w.position * pos + w.size * size + w.area * area + w.color * color + w.group * group + w.class * cls;
}

function padSquare(matrix: number[][], padValue: number): number[][] {
  const nRows = matrix.length;
  const nCols = nRows ? matrix[0]!.length : 0;
  const size = Math.max(nRows, nCols);
  const out: number[][] = [];

  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      if (r < nRows && c < nCols) row.push(matrix[r]![c]!);
      else row.push(padValue);
    }
    out.push(row);
  }

  return out;
}

export function matchNodes(
  start: NormalizedPathNode[],
  end: NormalizedPathNode[],
  weights?: MatchWeights
): MatchResult {
  const w: Required<MatchWeights> = { ...DEFAULT_WEIGHTS, ...(weights || {}) };

  const groupedStart = new Map<string, NormalizedPathNode[]>();
  for (const s of start) {
    const k = groupKey(s);
    const arr = groupedStart.get(k) || [];
    arr.push(s);
    groupedStart.set(k, arr);
  }

  const groupedEnd = new Map<string, NormalizedPathNode[]>();
  for (const e of end) {
    const k = groupKey(e);
    const arr = groupedEnd.get(k) || [];
    arr.push(e);
    groupedEnd.set(k, arr);
  }

  const keys = new Set<string>([...groupedStart.keys(), ...groupedEnd.keys()]);
  const pairs: MatchedPair[] = [];
  const unmatchedStart: NormalizedPathNode[] = [];
  const unmatchedEnd: NormalizedPathNode[] = [];

  for (const k of keys) {
    const s = groupedStart.get(k) || [];
    const e = groupedEnd.get(k) || [];
    const res = matchGroup(s, e, w);
    pairs.push(...res.pairs);
    unmatchedStart.push(...res.unmatchedStart);
    unmatchedEnd.push(...res.unmatchedEnd);
  }

  return { pairs, unmatchedStart, unmatchedEnd };
}

function matchGroup(
  start: NormalizedPathNode[],
  end: NormalizedPathNode[],
  w: Required<MatchWeights>
): MatchResult {
  const pairs: MatchedPair[] = [];

  const endByKey = new Map<string, NormalizedPathNode[]>();
  const endUsed = new Set<NormalizedPathNode>();

  for (const e of end) {
    const k = stableKey(e);
    if (!k) continue;
    const list = endByKey.get(k);
    if (list) list.push(e);
    else endByKey.set(k, [e]);
  }

  let startRemaining: NormalizedPathNode[] = [];
  for (const s of start) {
    const k = stableKey(s);
    if (!k) {
      startRemaining.push(s);
      continue;
    }

    const list = endByKey.get(k);
    const e = list && list.length ? list.shift()! : undefined;
    if (!e) {
      startRemaining.push(s);
      continue;
    }

    pairs.push({ start: s, end: e, cost: 0 });
    endUsed.add(e);
  }

  let endRemaining = end.filter((e) => !endUsed.has(e));

  if (startRemaining.length && endRemaining.length) {
    const startCounts = new Map<string, number>();
    for (const n of startRemaining) {
      for (const cls of classTokens(n)) {
        startCounts.set(cls, (startCounts.get(cls) || 0) + 1);
      }
    }

    const endCounts = new Map<string, number>();
    for (const n of endRemaining) {
      for (const cls of classTokens(n)) {
        endCounts.set(cls, (endCounts.get(cls) || 0) + 1);
      }
    }

    const uniqueTokens = new Set<string>();
    for (const [cls, count] of startCounts.entries()) {
      if (count === 1 && endCounts.get(cls) === 1) uniqueTokens.add(cls);
    }

    if (uniqueTokens.size) {
      const startByToken = new Map<string, NormalizedPathNode>();
      for (const n of startRemaining) {
        const tokens = classTokens(n);
        const hit = tokens.find((t) => uniqueTokens.has(t));
        if (hit) startByToken.set(hit, n);
      }

      const endByToken = new Map<string, NormalizedPathNode>();
      for (const n of endRemaining) {
        const tokens = classTokens(n);
        const hit = tokens.find((t) => uniqueTokens.has(t));
        if (hit) endByToken.set(hit, n);
      }

      const matchedStart = new Set<NormalizedPathNode>();
      const matchedEnd = new Set<NormalizedPathNode>();

      for (const token of uniqueTokens) {
        const s = startByToken.get(token);
        const e = endByToken.get(token);
        if (!s || !e) continue;
        pairs.push({ start: s, end: e, cost: 0 });
        matchedStart.add(s);
        matchedEnd.add(e);
      }

      if (matchedStart.size || matchedEnd.size) {
        startRemaining = startRemaining.filter((n) => !matchedStart.has(n));
        endRemaining = endRemaining.filter((n) => !matchedEnd.has(n));
      }
    }
  }

  if (startRemaining.length === 0 || endRemaining.length === 0) {
    return {
      pairs,
      unmatchedStart: startRemaining,
      unmatchedEnd: endRemaining
    };
  }

  const s = buildFeatures(startRemaining);
  const e = buildFeatures(endRemaining);
  const diag = Math.max(s.diag, e.diag);

  const costMatrix: number[][] = startRemaining.map((sn, i) => {
    return endRemaining.map((_en, j) => costBetween(s.features[i]!, e.features[j]!, diag, w));
  });

  const PAD_COST = 10_000;
  const square = padSquare(costMatrix, PAD_COST);

  const assignments = computeMunkres(square);

  const matchedStart = new Set<number>();
  const matchedEnd = new Set<number>();

  for (const [row, col] of assignments) {
    if (row < startRemaining.length && col < endRemaining.length) {
      const c = costMatrix[row]![col]!;
      pairs.push({ start: startRemaining[row]!, end: endRemaining[col]!, cost: c });
      matchedStart.add(row);
      matchedEnd.add(col);
    }
  }

  const unmatchedStart = startRemaining.filter((_, i) => !matchedStart.has(i));
  const unmatchedEnd = endRemaining.filter((_, i) => !matchedEnd.has(i));

  return { pairs, unmatchedStart, unmatchedEnd };
}
