import { parseSync } from 'svgson';
import { parseSvgToNodes } from './parse';
import { normalizeNodes, type NormalizedPathNode } from './normalize';

export type DefsShape = {
  id: string;
  kind: 'mask' | 'clipPath';
  nodes: NormalizedPathNode[];
  attrs: Record<string, string>;
};

type SvgsonAst = {
  name: string;
  attributes: Record<string, string>;
  children: SvgsonAst[];
};

function collectNodes(doc: Document, el: Element): NormalizedPathNode[] {
  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');

  for (const attr of ['transform', 'opacity', 'maskUnits', 'maskContentUnits', 'clipPathUnits']) {
    const val = el.getAttribute(attr);
    if (val) g.setAttribute(attr, val);
  }

  for (const child of Array.from(el.children)) {
    g.appendChild(child.cloneNode(true));
  }

  wrapper.appendChild(g);
  return normalizeNodes(parseSvgToNodes(wrapper.outerHTML));
}

function serializeNode(n: SvgsonAst): string {
  const attrs = Object.entries(n.attributes || {})
    .map(([k, v]) => ` ${k}="${String(v)}"`)
    .join('');
  if (!n.children || n.children.length === 0) return `<${n.name}${attrs}/>`;
  const kids = n.children.map(serializeNode).join('');
  return `<${n.name}${attrs}>${kids}</${n.name}>`;
}

function collectNodesFromAst(ast: SvgsonAst, el: SvgsonAst): NormalizedPathNode[] {
  const gAttrs: Record<string, string> = {};
  for (const attr of ['transform', 'opacity', 'maskUnits', 'maskContentUnits', 'clipPathUnits']) {
    const val = el.attributes?.[attr];
    if (val) gAttrs[attr] = val;
  }
  const gAttrStr = Object.entries(gAttrs)
    .map(([k, v]) => ` ${k}="${String(v)}"`)
    .join('');
  const children = (el.children || []).map(serializeNode).join('');
  const wrapper = `<svg><g${gAttrStr}>${children}</g></svg>`;
  return normalizeNodes(parseSvgToNodes(wrapper));
}

export function extractMaskClipDefs(svgText: string): { masks: Map<string, DefsShape>; clips: Map<string, DefsShape> } {
  const masks = new Map<string, DefsShape>();
  const clips = new Map<string, DefsShape>();

  if (typeof DOMParser === 'undefined') {
    const ast = parseSync(svgText, { camelcase: false }) as unknown as SvgsonAst;
    const queue: SvgsonAst[] = [ast];
    while (queue.length) {
      const node = queue.shift()!;
      if (node.name === 'mask' || node.name === 'clipPath') {
        const id = node.attributes?.id;
        if (id) {
          const nodes = collectNodesFromAst(ast, node);
          const out: DefsShape = {
            id,
            kind: node.name === 'mask' ? 'mask' : 'clipPath',
            nodes,
            attrs: node.attributes || {}
          };
          (node.name === 'mask' ? masks : clips).set(id, out);
        }
      }
      if (node.children?.length) queue.push(...node.children);
    }
    return { masks, clips };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');

    doc.querySelectorAll('mask').forEach((el) => {
      const id = el.getAttribute('id');
      if (!id) return;
      const nodes = collectNodes(doc, el);
      masks.set(id, {
        id,
        kind: 'mask',
        nodes,
        attrs: Object.fromEntries(Array.from(el.attributes).map((a) => [a.name, a.value]))
      });
    });

    doc.querySelectorAll('clipPath, clippath').forEach((el) => {
      const id = el.getAttribute('id');
      if (!id) return;
      const nodes = collectNodes(doc, el);
      clips.set(id, {
        id,
        kind: 'clipPath',
        nodes,
        attrs: Object.fromEntries(Array.from(el.attributes).map((a) => [a.name, a.value]))
      });
    });
  } catch {
    return { masks, clips };
  }

  return { masks, clips };
}
