function num(attrs: Record<string, string>, key: string, fallback = 0): number {
  const raw = attrs[key];
  if (raw == null || raw === '') return fallback;
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function formatNum(n: number): string {
  // Keep output stable and reasonably small.
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)));
}

export function shapeToPath(tag: string, attrs: Record<string, string>): string | null {
  if (tag === 'path') {
    const d = attrs.d;
    return typeof d === 'string' && d.trim() ? d : null;
  }

  if (tag === 'rect') {
    const x = num(attrs, 'x', 0);
    const y = num(attrs, 'y', 0);
    const width = num(attrs, 'width', 0);
    const height = num(attrs, 'height', 0);
    if (width <= 0 || height <= 0) return null;

    // Rounded corners: rx/ry per SVG spec.
    let rx = num(attrs, 'rx', NaN);
    let ry = num(attrs, 'ry', NaN);
    if (!Number.isFinite(rx) && Number.isFinite(ry)) rx = ry;
    if (!Number.isFinite(ry) && Number.isFinite(rx)) ry = rx;

    if (!Number.isFinite(rx) || !Number.isFinite(ry) || (rx <= 0 && ry <= 0)) {
      const x2 = x + width;
      const y2 = y + height;
      return `M${formatNum(x)} ${formatNum(y)} H${formatNum(x2)} V${formatNum(y2)} H${formatNum(x)} Z`;
    }

    rx = clamp(rx, 0, width / 2);
    ry = clamp(ry, 0, height / 2);

    const x2 = x + width;
    const y2 = y + height;

    // Path for rounded rect.
    return [
      `M${formatNum(x + rx)} ${formatNum(y)}`,
      `H${formatNum(x2 - rx)}`,
      `A${formatNum(rx)} ${formatNum(ry)} 0 0 1 ${formatNum(x2)} ${formatNum(y + ry)}`,
      `V${formatNum(y2 - ry)}`,
      `A${formatNum(rx)} ${formatNum(ry)} 0 0 1 ${formatNum(x2 - rx)} ${formatNum(y2)}`,
      `H${formatNum(x + rx)}`,
      `A${formatNum(rx)} ${formatNum(ry)} 0 0 1 ${formatNum(x)} ${formatNum(y2 - ry)}`,
      `V${formatNum(y + ry)}`,
      `A${formatNum(rx)} ${formatNum(ry)} 0 0 1 ${formatNum(x + rx)} ${formatNum(y)}`,
      'Z'
    ].join(' ');
  }

  if (tag === 'circle') {
    const cx = num(attrs, 'cx', 0);
    const cy = num(attrs, 'cy', 0);
    const r = num(attrs, 'r', 0);
    if (r <= 0) return null;

    const x0 = cx - r;
    const x1 = cx + r;

    return `M${formatNum(x0)} ${formatNum(cy)} A${formatNum(r)} ${formatNum(r)} 0 1 0 ${formatNum(x1)} ${formatNum(cy)} A${formatNum(r)} ${formatNum(r)} 0 1 0 ${formatNum(x0)} ${formatNum(cy)} Z`;
  }

  if (tag === 'ellipse') {
    const cx = num(attrs, 'cx', 0);
    const cy = num(attrs, 'cy', 0);
    const rx = num(attrs, 'rx', 0);
    const ry = num(attrs, 'ry', 0);
    if (rx <= 0 || ry <= 0) return null;

    const x0 = cx - rx;
    const x1 = cx + rx;

    return `M${formatNum(x0)} ${formatNum(cy)} A${formatNum(rx)} ${formatNum(ry)} 0 1 0 ${formatNum(x1)} ${formatNum(cy)} A${formatNum(rx)} ${formatNum(ry)} 0 1 0 ${formatNum(x0)} ${formatNum(cy)} Z`;
  }

  if (tag === 'line') {
    const x1 = num(attrs, 'x1', 0);
    const y1 = num(attrs, 'y1', 0);
    const x2 = num(attrs, 'x2', 0);
    const y2 = num(attrs, 'y2', 0);
    return `M${formatNum(x1)} ${formatNum(y1)} L${formatNum(x2)} ${formatNum(y2)}`;
  }

  if (tag === 'polyline' || tag === 'polygon') {
    const pointsRaw = attrs.points;
    if (typeof pointsRaw !== 'string' || pointsRaw.trim() === '') return null;

    const tokens = pointsRaw
      .trim()
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const nums: number[] = [];
    for (const t of tokens) {
      const v = Number.parseFloat(t);
      if (!Number.isFinite(v)) continue;
      nums.push(v);
    }

    if (nums.length < 4) return null;

    const pairs: Array<[number, number]> = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      pairs.push([nums[i]!, nums[i + 1]!]);
    }

    if (pairs.length < 2) return null;

    const [x0, y0] = pairs[0]!;
    const parts: string[] = [`M${formatNum(x0)} ${formatNum(y0)}`];
    for (let i = 1; i < pairs.length; i++) {
      const [x, y] = pairs[i]!;
      parts.push(`L${formatNum(x)} ${formatNum(y)}`);
    }
    if (tag === 'polygon') parts.push('Z');
    return parts.join(' ');
  }

  return null;
}
