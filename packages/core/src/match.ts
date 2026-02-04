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
};

const DEFAULT_WEIGHTS: Required<MatchWeights> = {
  position: 1,
  size: 0.35,
  area: 0.15,
  color: 0.3,
  length: 0
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
      fill: parseColorToRgba(n.fill)
    };
  });

  return { features, diag };
}

function costBetween(a: NodeFeatures, b: NodeFeatures, diag: number, w: Required<MatchWeights>): number {
  const sizeRatio = Math.max(
    a.width / (b.width || 1),
    b.width / (a.width || 1),
    a.height / (b.height || 1),
    b.height / (a.height || 1)
  );
  if (sizeRatio > 3) return 10_000;

  const pos = Math.hypot(a.cx - b.cx, a.cy - b.cy) / diag;
  const size = Math.hypot(a.width - b.width, a.height - b.height) / diag;
  const area = Math.abs(a.area - b.area) / (Math.max(a.area, b.area, 1));
  const color = rgbaDistance(a.fill, b.fill);

  return w.position * pos + w.size * size + w.area * area + w.color * color;
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

  const startRemaining: NormalizedPathNode[] = [];
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

  const endRemaining = end.filter((e) => !endUsed.has(e));

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
