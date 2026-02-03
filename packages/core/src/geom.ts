import svgpath from 'svgpath';

export type BBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  area: number;
};

export function bboxFromPathD(d: string): BBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let hasPoint = false;

  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    hasPoint = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  try {
    svgpath(d)
      .unshort()
      .unarc()
      .abs()
      .iterate((seg, _i, x, y) => {
        const cmd = seg[0];
        switch (cmd) {
          case 'M':
          case 'L':
          case 'T': {
            add(seg[1] as number, seg[2] as number);
            break;
          }
          case 'H': {
            add(seg[1] as number, y);
            break;
          }
          case 'V': {
            add(x, seg[1] as number);
            break;
          }
          case 'C': {
            add(seg[1] as number, seg[2] as number);
            add(seg[3] as number, seg[4] as number);
            add(seg[5] as number, seg[6] as number);
            break;
          }
          case 'S': {
            add(seg[1] as number, seg[2] as number);
            add(seg[3] as number, seg[4] as number);
            break;
          }
          case 'Q': {
            add(seg[1] as number, seg[2] as number);
            add(seg[3] as number, seg[4] as number);
            break;
          }
          // After .unarc() there should be no arcs, but keep a safe fallback.
          case 'A': {
            add(seg[6] as number, seg[7] as number);
            break;
          }
          default:
            break;
        }
      });
  } catch {
    // Keep default empty bbox below.
  }

  if (!hasPoint) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0, area: 0 };
  }

  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cx: minX + width / 2,
    cy: minY + height / 2,
    area: Math.max(0, width) * Math.max(0, height)
  };
}

export type Rgba = { r: number; g: number; b: number; a: number };

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function parseColorToRgba(input: string | undefined): Rgba | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s || s === 'none' || s === 'transparent') return null;

  // #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0]! + hex[0]!, 16);
      const g = Number.parseInt(hex[1]! + hex[1]!, 16);
      const b = Number.parseInt(hex[2]! + hex[2]!, 16);
      const a = hex.length === 4 ? Number.parseInt(hex[3]! + hex[3]!, 16) / 255 : 1;
      if ([r, g, b].some((v) => Number.isNaN(v)) || Number.isNaN(a)) return null;
      return { r, g, b, a: clamp01(a) };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b].some((v) => Number.isNaN(v)) || Number.isNaN(a)) return null;
      return { r, g, b, a: clamp01(a) };
    }
    return null;
  }

  // rgb()/rgba() with commas or spaces
  const m = s.match(/^rgba?\((.+)\)$/);
  if (m) {
    const body = m[1]!.trim();
    const parts = body
      .replace(/\s*\/\s*/g, ' ')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length < 3) return null;
    const r = Number.parseFloat(parts[0]!);
    const g = Number.parseFloat(parts[1]!);
    const b = Number.parseFloat(parts[2]!);
    const a = parts.length >= 4 ? Number.parseFloat(parts[3]!) : 1;

    if (![r, g, b, a].every((v) => Number.isFinite(v))) return null;

    return {
      r: Math.max(0, Math.min(255, r)),
      g: Math.max(0, Math.min(255, g)),
      b: Math.max(0, Math.min(255, b)),
      a: clamp01(a)
    };
  }

  // Unknown formats (named colors, currentColor, url(...), etc.)
  return null;
}

export function rgbaDistance(a: Rgba | null, b: Rgba | null): number {
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = (a.a - b.a) * 255;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
  const max = Math.sqrt(4 * 255 * 255);
  return dist / max;
}
