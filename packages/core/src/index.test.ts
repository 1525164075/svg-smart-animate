import { describe, it, expect } from 'vitest';
import { animateSvg } from './index';

describe('core exports', () => {
  it('exports animateSvg', () => {
    expect(typeof animateSvg).toBe('function');
  });
});
