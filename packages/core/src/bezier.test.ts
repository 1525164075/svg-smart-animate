import { describe, it, expect } from 'vitest';
import { evalBezier } from './bezier';

describe('evalBezier', () => {
  it('returns endpoints and behaves like linear for (0,0,1,1)', () => {
    const linear = { x1: 0, y1: 0, x2: 1, y2: 1 };
    expect(evalBezier(0, linear)).toBe(0);
    expect(evalBezier(1, linear)).toBe(1);
    expect(evalBezier(0.5, linear)).toBeCloseTo(0.5, 4);
  });
});
