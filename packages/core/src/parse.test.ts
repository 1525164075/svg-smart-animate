import { describe, it, expect } from 'vitest';
import { parseSvgToNodes } from './parse';
import { extractMaskClipDefs } from './defs';

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

  it('keeps filtered nodes even when opacity is low', () => {
    const svgWithFilter = `
      <svg viewBox="0 0 100 100">
        <g filter="url(#blur)" opacity="0.1">
          <circle id="glow" cx="50" cy="50" r="20" fill="#fff"/>
        </g>
        <circle id="main" cx="50" cy="50" r="10" fill="#000"/>
      </svg>
    `;
    const nodes = parseSvgToNodes(svgWithFilter);
    expect(nodes.length).toBe(2);
  });

  it('keeps filtered nodes when opacity is not low', () => {
    const svgWithFilter = `
      <svg viewBox="0 0 100 100">
        <g filter="url(#inner)">
          <rect id="kept" x="10" y="10" width="20" height="20" fill="#fff"/>
        </g>
      </svg>
    `;
    const nodes = parseSvgToNodes(svgWithFilter);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('kept');
  });

  it('keeps filtered nodes even when opacity is low', () => {
    const svgWithFilter = `
      <svg viewBox="0 0 100 100">
        <g filter="url(#blur)" opacity="0.1">
          <rect id="dropped" x="10" y="10" width="20" height="20" fill="#fff"/>
        </g>
      </svg>
    `;
    const nodes = parseSvgToNodes(svgWithFilter);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('dropped');
  });

  it('applies class styles from <style> when attrs are missing', () => {
    const svgWithStyle = `
      <svg viewBox="0 0 100 100">
        <style>
          .st0 { fill: #ff0000; stroke: #000000; }
        </style>
        <rect id="r" class="st0" x="10" y="10" width="10" height="10"/>
      </svg>
    `;
    const nodes = parseSvgToNodes(svgWithStyle);
    expect(nodes.length).toBe(1);
    expect(nodes[0].attrs.fill).toBe('#ff0000');
    expect(nodes[0].attrs.stroke).toBe('#000000');
  });

  it('extracts mask and clipPath nodes from defs', () => {
    const svgWithDefs = `
      <svg viewBox="0 0 10 10">
        <defs>
          <clipPath id="clipA"><rect x="0" y="0" width="5" height="5"/></clipPath>
          <mask id="maskB"><circle cx="5" cy="5" r="3" fill="white"/></mask>
        </defs>
        <rect x="0" y="0" width="10" height="10"/>
      </svg>`;
    const defs = extractMaskClipDefs(svgWithDefs);
    expect(defs.clips.get('clipA')?.nodes.length).toBe(1);
    expect(defs.masks.get('maskB')?.nodes.length).toBe(1);
  });
});
