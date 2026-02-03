import { describe, it, expect } from 'vitest';
import { parseSvgToNodes } from './parse';

const svg = `<svg viewBox="0 0 100 100"><path id="p" d="M10 10 L90 10" fill="none" stroke="black"/></svg>`;

describe('parseSvgToNodes', () => {
  it('extracts path nodes with id and d attr', () => {
    const nodes = parseSvgToNodes(svg);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('p');
    expect(nodes[0].tag).toBe('path');
    expect(nodes[0].attrs.d).toContain('M');
  });

  it('ignores nodes inside defs/clipPath/mask/gradients', () => {
    const svgWithDefs = `
      <svg viewBox="0 0 100 100">
        <defs>
          <clipPath id="c">
            <rect id="clip-rect" width="100" height="100" fill="white"/>
          </clipPath>
          <linearGradient id="g">
            <stop offset="0" stop-color="#fff"/>
          </linearGradient>
        </defs>
        <rect id="visible" x="0" y="0" width="10" height="10" fill="#000"/>
      </svg>
    `;
    const nodes = parseSvgToNodes(svgWithDefs);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('visible');
  });

  it('ignores nodes inside filter groups', () => {
    const svgWithFilter = `
      <svg viewBox="0 0 100 100">
        <g filter="url(#blur)">
          <circle id="glow" cx="50" cy="50" r="20" fill="#fff"/>
        </g>
        <circle id="main" cx="50" cy="50" r="10" fill="#000"/>
      </svg>
    `;
    const nodes = parseSvgToNodes(svgWithFilter);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('main');
  });
});
