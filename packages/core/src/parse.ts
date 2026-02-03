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

function walk(node: SvgsonAst, visitor: (n: SvgsonAst) => void, blocked: boolean): void {
  const isBlocked = blocked || BLOCKED_ANCESTORS.has(node.name);
  if (isBlocked) return;

  visitor(node);
  for (const child of node.children) walk(child, visitor, isBlocked);
}

export function parseSvgToNodes(svg: string): RawSvgNode[] {
  const ast = parseSync(svg, { camelcase: false }) as unknown as SvgsonAst;

  const nodes: RawSvgNode[] = [];
  let autoId = 0;
  let order = 0;

  walk(ast, (n) => {
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

    nodes.push({
      id,
      order: order++,
      tag,
      attrs: { ...n.attributes }
    });
  }, false);

  return nodes;
}
