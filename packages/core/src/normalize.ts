import type { RawSvgNode } from './parse';
import { shapeToPath } from './shapeToPath';
import { applyTransformToPathD } from './transform';

export type NormalizedPathNode = {
  id: string;
  order: number;
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
    const node: NormalizedPathNode = {
      id: n.id,
      order: n.order,
      tag: n.tag,
      d,
      attrs: n.attrs
    };

    if (n.attrs.fill !== undefined) node.fill = n.attrs.fill;
    if (n.attrs.stroke !== undefined) node.stroke = n.attrs.stroke;
    if (typeof opacity === 'number' && Number.isFinite(opacity)) node.opacity = opacity;

    out.push(node);
  }

  return out;
}
