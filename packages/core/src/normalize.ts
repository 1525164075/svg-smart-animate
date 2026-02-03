import type { RawSvgNode } from './parse';
import { shapeToPath } from './shapeToPath';
import { applyTransformToPathD } from './transform';

export type NormalizedPathNode = {
  id: string;
  tag: string;
  d: string;
  fill?: string;
  stroke?: string;
  opacity?: number;
  attrs: Record<string, string>;
};

export function normalizeNodes(raw: RawSvgNode[]): NormalizedPathNode[] {
  const out: NormalizedPathNode[] = [];

  for (const n of raw) {
    const d0 = shapeToPath(n.tag, n.attrs);
    if (!d0) continue;

    const d = applyTransformToPathD(d0, n.attrs.transform);

    const opacity = n.attrs.opacity ? Number.parseFloat(n.attrs.opacity) : undefined;
    out.push({
      id: n.id,
      tag: n.tag,
      d,
      fill: n.attrs.fill,
      stroke: n.attrs.stroke,
      opacity: Number.isFinite(opacity) ? opacity : undefined,
      attrs: n.attrs
    });
  }

  return out;
}
