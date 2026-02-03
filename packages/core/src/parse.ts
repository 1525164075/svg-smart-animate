import { parseSync } from 'svgson';

export type RawSvgNode = {
  id: string;
  order: number;
  tag: string;
  attrs: Record<string, string>;
};

type SvgsonAst = {
  name: string;
  attributes: Record<string, string>;
  children: SvgsonAst[];
};

type InheritedAttrs = {
  transform?: string;
  opacity?: number;
  filter?: string;
  clipPath?: string;
  mask?: string;
};

const BLOCKED_ANCESTORS = new Set([
  'defs',
  'clipPath',
  'mask',
  'filter',
  'linearGradient',
  'radialGradient',
  'pattern',
  'symbol'
]);

function toNumber(v: string | undefined): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function mergeTransform(parent: string | undefined, own: string | undefined): string | undefined {
  if (parent && own) return `${parent} ${own}`;
  return own || parent;
}

function inheritAttrs(parent: InheritedAttrs, node: SvgsonAst): InheritedAttrs {
  const ownOpacity = toNumber(node.attributes.opacity);
  const nextOpacity =
    ownOpacity == null ? parent.opacity : parent.opacity == null ? ownOpacity : parent.opacity * ownOpacity;

  return {
    transform: mergeTransform(parent.transform, node.attributes.transform),
    opacity: nextOpacity,
    filter: node.attributes.filter ?? parent.filter,
    clipPath: node.attributes['clip-path'] ?? parent.clipPath,
    mask: node.attributes.mask ?? parent.mask
  };
}

function applyInheritedToAttrs(attrs: Record<string, string>, inherited: InheritedAttrs): void {
  if (inherited.transform && !attrs.transform) attrs.transform = inherited.transform;
  if (inherited.transform && attrs.transform && inherited.transform !== attrs.transform) {
    attrs.transform = mergeTransform(inherited.transform, attrs.transform);
  }

  if (inherited.opacity != null) {
    const ownOpacity = toNumber(attrs.opacity);
    const combined = ownOpacity == null ? inherited.opacity : inherited.opacity * ownOpacity;
    attrs.opacity = String(combined);
  }

  if (inherited.filter && !attrs.filter) attrs.filter = inherited.filter;
  if (inherited.clipPath && !attrs['clip-path']) attrs['clip-path'] = inherited.clipPath;
  if (inherited.mask && !attrs.mask) attrs.mask = inherited.mask;
}

function walk(
  node: SvgsonAst,
  visitor: (n: SvgsonAst, inherited: InheritedAttrs) => void,
  blocked: boolean,
  inherited: InheritedAttrs
): void {
  const isBlocked = blocked || BLOCKED_ANCESTORS.has(node.name);
  if (isBlocked) return;

  const nextInherited = inheritAttrs(inherited, node);
  visitor(node, nextInherited);
  for (const child of node.children) walk(child, visitor, isBlocked, nextInherited);
}

export function parseSvgToNodes(svg: string): RawSvgNode[] {
  const ast = parseSync(svg, { camelcase: false }) as unknown as SvgsonAst;

  const nodes: RawSvgNode[] = [];
  let autoId = 0;
  let order = 0;

  walk(ast, (n, inherited) => {
    const tag = n.name;
    if (
      tag !== 'path' &&
      tag !== 'rect' &&
      tag !== 'circle' &&
      tag !== 'ellipse' &&
      tag !== 'line' &&
      tag !== 'polyline' &&
      tag !== 'polygon'
    ) {
      return;
    }

    const id = (n.attributes?.id || n.attributes?.['data-name'] || `__auto_${autoId++}`).trim();
    const attrs = { ...n.attributes };
    applyInheritedToAttrs(attrs, inherited);

    nodes.push({
      id,
      order: order++,
      tag,
      attrs
    });
  }, false, {});

  return nodes;
}
