import { describe, it, expect } from 'vitest';
import { parseSvgToNodes } from './parse';

const svg = `<svg viewBox="0 0 100 100"><path id="p" d="M10 10 L90 10" fill="none" stroke="black"/></svg>`;

describe('parseSvgToNodes', () => {
  it('extracts path nodes with id and d attr', async () => {
    const nodes = await parseSvgToNodes(svg);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('p');
    expect(nodes[0].tag).toBe('path');
    expect(nodes[0].attrs.d).toContain('M');
  });
});
