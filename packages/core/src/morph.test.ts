import { describe, it, expect } from 'vitest';
import { createPathInterpolator } from './morph';
import { makeAppearStartPath } from './appear';
import { shapeToPath } from './shapeToPath';

function rectPath(x: number): string {
  return shapeToPath('rect', { x: String(x), y: '0', width: '10', height: '10' })!;
}

describe('morph', () => {
  it('creates an interpolator that returns valid path strings for t=0 and t=1', () => {
    const from = rectPath(0);
    const to = rectPath(100);

    const interp = createPathInterpolator(from, to, { maxSegmentLength: 2 });
    expect(interp(0)).toMatch(/^M/);
    expect(interp(1)).toMatch(/^M/);
  });

  it('generates an appear start path different from end', () => {
    const end = rectPath(0);
    const start = makeAppearStartPath(end, { style: 'collapse-to-centroid' });
    expect(start).not.toBe(end);
    expect(start).toMatch(/^M/);
  });

  it('keeps open paths open when closed=false', () => {
    const from = 'M0 0 L10 0';
    const to = 'M0 10 L10 10';
    const interp = createPathInterpolator(from, to, { closed: false });
    const mid = interp(0.5);
    expect(/z/i.test(mid)).toBe(false);
  });
});
