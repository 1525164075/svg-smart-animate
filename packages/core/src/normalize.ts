import type { RawSvgPathNode } from './parse';

export type NormalizedPathNode = {
  id: string;
  d: string;
  fill?: string;
  stroke?: string;
  opacity?: number;
  transform?: string;
  attrs: Record<string, string>;
};

export function normalizeNodes(raw: RawSvgPathNode[]): NormalizedPathNode[] {
  return raw.map((n) => {
    const opacity = n.attrs.opacity ? Number.parseFloat(n.attrs.opacity) : undefined;
    return {
      id: n.id,
      d: n.d,
      fill: n.attrs.fill,
      stroke: n.attrs.stroke,
      opacity: Number.isFinite(opacity) ? opacity : undefined,
      transform: n.attrs.transform,
      attrs: n.attrs
    };
  });
}
