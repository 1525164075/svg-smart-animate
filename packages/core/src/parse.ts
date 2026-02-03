import { parseSync } from 'svgson';

export type RawSvgNode = {
  id: string;
  tag: string;
  attrs: Record<string, string>;
};

type SvgsonAst = {
  name: string;
  attributes: Record<string, string>;
  children: SvgsonAst[];
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

function parseOpacity(value: string | undefined): number | null {
  if (!value) return null;
  const v = Number.parseFloat(value);
  return Number.isFinite(v) ? v : null;
}

function walk(
  node: SvgsonAst,
  visitor: (n: SvgsonAst, ctx: { filterActive: boolean; opacity: number }) => void,
  ctx: { blocked: boolean; filterActive: boolean; opacity: number }
): void {
  const isBlocked = ctx.blocked || BLOCKED_ANCESTORS.has(node.name);
  if (isBlocked) return;

  const nodeOpacity = parseOpacity(node.attributes?.opacity);
  const nextOpacity = nodeOpacity === null ? ctx.opacity : ctx.opacity * nodeOpacity;
  const hasFilter = typeof node.attributes?.filter === 'string' && node.attributes.filter.trim() !== '';
  const nextFilter = ctx.filterActive || hasFilter;

  visitor(node, { filterActive: nextFilter, opacity: nextOpacity });
  for (const child of node.children) {
    walk(child, visitor, { blocked: isBlocked, filterActive: nextFilter, opacity: nextOpacity });
  }
}

export function parseSvgToNodes(svg: string): RawSvgNode[] {
  const ast = parseSync(svg, { camelcase: false }) as unknown as SvgsonAst;

  const nodes: RawSvgNode[] = [];
  let autoId = 0;

  walk(ast, (n, ctx) => {
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

    // Drop glow-like nodes inside filtered groups when very low opacity.
    if (ctx.filterActive && ctx.opacity < 0.2) return;

    const id = (n.attributes?.id || n.attributes?.['data-name'] || `__auto_${autoId++}`).trim();
    const attrs = { ...n.attributes };

    if (ctx.filterActive && attrs.filter) delete attrs.filter;
    if (!('opacity' in attrs) && ctx.opacity !== 1) attrs.opacity = String(ctx.opacity);

    nodes.push({
      id,
      tag,
      attrs
    });
  }, { blocked: false, filterActive: false, opacity: 1 });

  return nodes;
}
