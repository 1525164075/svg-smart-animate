import { parse } from 'svgson';

export type RawSvgPathNode = {
  id: string;
  name?: string;
  d: string;
  attrs: Record<string, string>;
};

type SvgsonAst = {
  name: string;
  attributes: Record<string, string>;
  children: SvgsonAst[];
};

function walk(node: SvgsonAst, visitor: (n: SvgsonAst) => void): void {
  visitor(node);
  for (const child of node.children) walk(child, visitor);
}

export async function parseSvgToNodes(svg: string): Promise<RawSvgPathNode[]> {
  const ast = (await parse(svg, { camelcase: false })) as unknown as SvgsonAst;

  const nodes: RawSvgPathNode[] = [];
  let autoId = 0;

  walk(ast, (n) => {
    if (n.name !== 'path') return;
    const d = n.attributes?.d;
    if (typeof d !== 'string' || d.trim() === '') return;

    const id = (n.attributes?.id || n.attributes?.['data-name'] || `__auto_${autoId++}`).trim();

    nodes.push({
      id,
      name: n.attributes?.['data-name'],
      d,
      attrs: { ...n.attributes }
    });
  });

  return nodes;
}
