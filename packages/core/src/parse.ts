import { parseSync } from 'svgson';

export type RawSvgNode = {
  id: string;
  order: number;
  tag: string;
  attrs: Record<string, string>;
  classList?: string[];
  pathKey?: string;
};

type SvgsonAst = {
  name: string;
  attributes: Record<string, string>;
  children: SvgsonAst[];
};

type StyleMaps = {
  byClass: Map<string, Record<string, string>>;
  byId: Map<string, Record<string, string>>;
  byTag: Map<string, Record<string, string>>;
};

type InheritedAttrs = {
  transform?: string;
  opacity?: number;
  filter?: string;
  clipPath?: string;
  mask?: string;
  pathTokens?: string[];
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

function splitClassList(input: string | undefined): string[] {
  if (!input) return [];
  return String(input)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function nodeKeyFromAttrs(attrs: Record<string, string>): string | null {
  const id = attrs.id?.trim();
  if (id) return `id:${id}`;
  const name = attrs['data-name']?.trim();
  if (name) return `name:${name}`;
  const cls = splitClassList(attrs.class || attrs.className)[0];
  if (cls) return `class:${cls}`;
  return null;
}

function parseStyleDeclarations(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = input.split(';');
  for (const part of parts) {
    const [rawKey, rawVal] = part.split(':');
    if (!rawKey || !rawVal) continue;
    const key = rawKey.trim();
    const value = rawVal.trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

function parseStyleText(cssText: string): StyleMaps {
  const byClass = new Map<string, Record<string, string>>();
  const byId = new Map<string, Record<string, string>>();
  const byTag = new Map<string, Record<string, string>>();

  const rules = cssText.split('}');
  for (const rule of rules) {
    const [selectorRaw, bodyRaw] = rule.split('{');
    if (!selectorRaw || !bodyRaw) continue;
    const body = bodyRaw.trim();
    if (!body) continue;
    const declarations = parseStyleDeclarations(body);

    const selectors = selectorRaw.split(',').map((s) => s.trim()).filter(Boolean);
    for (const selector of selectors) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1).trim();
        if (cls) byClass.set(cls, { ...(byClass.get(cls) || {}), ...declarations });
        continue;
      }
      if (selector.startsWith('#')) {
        const id = selector.slice(1).trim();
        if (id) byId.set(id, { ...(byId.get(id) || {}), ...declarations });
        continue;
      }
      if (/^[a-zA-Z][\\w-]*$/.test(selector)) {
        byTag.set(selector, { ...(byTag.get(selector) || {}), ...declarations });
      }
    }
  }

  return { byClass, byId, byTag };
}

function extractStyleMaps(svgText: string): StyleMaps {
  const empty = { byClass: new Map(), byId: new Map(), byTag: new Map() };
  if (typeof DOMParser === 'undefined') {
    const matches = svgText.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (!matches) return empty;
    const cssText = matches
      .map((m) => m.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, ''))
      .join('\\n');
    return parseStyleText(cssText);
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const styles = Array.from(doc.querySelectorAll('style'));
    const cssText = styles.map((s) => s.textContent || '').join('\\n');
    return parseStyleText(cssText);
  } catch {
    return empty;
  }
}

function applyStyleIfMissing(attrs: Record<string, string>, style: Record<string, string> | undefined): void {
  if (!style) return;
  for (const [key, value] of Object.entries(style)) {
    if (attrs[key] === undefined) attrs[key] = value;
  }
}

function inheritAttrs(parent: InheritedAttrs, node: SvgsonAst): InheritedAttrs {
  const ownOpacity = toNumber(node.attributes.opacity);
  const nextOpacity =
    ownOpacity == null ? parent.opacity : parent.opacity == null ? ownOpacity : parent.opacity * ownOpacity;

  const parentPath = parent.pathTokens ?? [];
  const ownKey = nodeKeyFromAttrs(node.attributes);
  const pathTokens = ownKey ? [...parentPath, ownKey] : parentPath;

  return {
    transform: mergeTransform(parent.transform, node.attributes.transform),
    opacity: nextOpacity,
    filter: node.attributes.filter ?? parent.filter,
    clipPath: node.attributes['clip-path'] ?? parent.clipPath,
    mask: node.attributes.mask ?? parent.mask,
    pathTokens
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
  const styleMaps = extractStyleMaps(svg);

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
    const tagStyle = styleMaps.byTag.get(tag);
    const idStyle = styleMaps.byId.get(id);

    applyStyleIfMissing(attrs, tagStyle);

    const classList = splitClassList(attrs.class || attrs.className);
    for (const cls of classList) {
      applyStyleIfMissing(attrs, styleMaps.byClass.get(cls));
    }

    applyStyleIfMissing(attrs, idStyle);

    if (attrs.style) {
      const inline = parseStyleDeclarations(attrs.style);
      for (const [key, value] of Object.entries(inline)) {
        attrs[key] = value;
      }
    }

    applyInheritedToAttrs(attrs, inherited);

    nodes.push({
      id,
      order: order++,
      tag,
      attrs,
      classList: classList.length ? classList : undefined,
      pathKey: inherited.pathTokens?.join('/') || undefined
    });
  }, false, {});

  return nodes;
}
