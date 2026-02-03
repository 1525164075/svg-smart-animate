import { describe, it, expect } from 'vitest';
import { shapeToPath } from './shapeToPath';

describe('shapeToPath', () => {
  it('converts rect to a closed path with corners', () => {
    const d = shapeToPath('rect', { x: '10', y: '20', width: '30', height: '40' });
    expect(d).toBeTypeOf('string');
    // M10 20 -> H40 -> V60 -> H10 -> Z
    expect(d).toMatch(/^M10 20 H40 V60 H10 Z$/);
  });

  it('converts circle to arcs', () => {
    const d = shapeToPath('circle', { cx: '50', cy: '50', r: '10' });
    expect(d).toBeTypeOf('string');
    expect(d).toContain('A10 10');
    // Starts at cx-r
    expect(d).toMatch(/^M40 50/);
    // Closed path
    expect(d).toMatch(/Z$/);
  });
});
