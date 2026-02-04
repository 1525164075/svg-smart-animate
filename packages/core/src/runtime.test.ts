/** @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import { animateSvg } from './index';
import { bboxFromPathD } from './geom';
import { svgPathProperties } from 'svg-path-properties';

// jsdom does not implement SVGPathElement.getTotalLength/getPointAtLength (and often does not even expose SVGPathElement),
// but flubber relies on them.
const proto = ((globalThis as any).SVGPathElement?.prototype ?? (globalThis as any).SVGElement?.prototype) as
  | {
      getTotalLength?: () => number;
      getPointAtLength?: (distance: number) => { x: number; y: number };
    }
  | undefined;

if (proto) {
  if (!proto.getTotalLength) {
    proto.getTotalLength = function getTotalLength(this: SVGElement): number {
      const d = this.getAttribute('d') || '';
      return new svgPathProperties(d).getTotalLength();
    };
  }

  if (!proto.getPointAtLength) {
    proto.getPointAtLength = function getPointAtLength(this: SVGElement, distance: number): { x: number; y: number } {
      const d = this.getAttribute('d') || '';
      return new svgPathProperties(d).getPointAtLength(distance);
    };
  }
}

describe('animateSvg runtime', () => {
  it('seek(0) uses start and seek(1) uses end', () => {
    const startSvg = `<svg viewBox="0 0 100 100"><path id="p" d="M0 0 H10 V10 H0 Z" fill="#ff0000"/></svg>`;
    const endSvg = `<svg viewBox="0 0 100 100"><path id="p" d="M50 0 H60 V10 H50 Z" fill="#ff0000"/></svg>`;

    const container = document.createElement('div');
    const controller = animateSvg({ startSvg, endSvg, container, options: { duration: 100 } });

    const path = container.querySelector('path');
    expect(path).toBeTruthy();

    controller.seek(0);
    expect(path!.getAttribute('d')).toBe('M0 0 H10 V10 H0 Z');

    controller.seek(1);
    expect(path!.getAttribute('d')).toBe('M50 0 H60 V10 H50 Z');

    controller.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('single-SVG appear uses SVG default fill when fill is omitted', () => {
    const endSvg = `<svg viewBox=\"0 0 100 100\"><path id=\"p\" d=\"M0 0 H10 V10 H0 Z\"/></svg>`;

    const container = document.createElement('div');
    const controller = animateSvg({ endSvg, container, options: { duration: 100 } });

    controller.seek(1);

    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    // SVG default fill is black. We should not force it to 'none' (invisible).
    expect(path!.getAttribute('fill')).not.toBe('none');
  });

  it('single-SVG appear draws open stroke paths with dash animation', () => {
    const endSvg = `<svg viewBox=\"0 0 100 100\"><path id=\"p\" d=\"M10 10 L90 10\" stroke=\"#000\" stroke-width=\"2\"/></svg>`;

    const container = document.createElement('div');
    const controller = animateSvg({ endSvg, container, options: { duration: 100 } });

    controller.seek(0);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path!.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(path!.getAttribute('stroke-dashoffset')).toBeTruthy();
  });

  it('single-SVG appear preserves existing dasharray', () => {
    const endSvg = `<svg viewBox=\"0 0 100 100\"><path id=\"p\" d=\"M10 10 L90 10\" stroke=\"#000\" stroke-width=\"2\" stroke-dasharray=\"2 4\"/></svg>`;

    const container = document.createElement('div');
    const controller = animateSvg({ endSvg, container, options: { duration: 100 } });

    controller.seek(0);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path!.getAttribute('stroke-dasharray')).toBe('2 4');
  });

  it('gsap ease preset A is non-linear at mid-progress', () => {
    const startSvg = `<svg viewBox=\"0 0 100 100\"><path id=\"p\" d=\"M0 0 H10 V10 H0 Z\" fill=\"#ff0000\"/></svg>`;
    const endSvg = `<svg viewBox=\"0 0 100 100\"><path id=\"p\" d=\"M50 0 H60 V10 H50 Z\" fill=\"#ff0000\"/></svg>`;

    const container = document.createElement('div');
    const controller = animateSvg({
      startSvg,
      endSvg,
      container,
      options: { duration: 100, timeline: 'gsap', gsapEasePreset: 'fast-out-slow-in' }
    });

    controller.seek(0.5);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();

    const d = path!.getAttribute('d') || '';
    const match = d.match(/M\s*([0-9.\-]+)[,\s]/);
    const x = match ? Number.parseFloat(match[1]!) : 0;
    // Linear midpoint would be 25. With ease-out, it should be > 25.
    expect(x).toBeGreaterThan(25);
  });

  it('orbit motion moves along arc instead of straight line', () => {
    const startSvg = `<svg viewBox=\"0 0 100 100\">\n      <circle id=\"orbit\" cx=\"50\" cy=\"50\" r=\"20\" stroke=\"#000\" fill=\"none\"/>\n      <rect id=\"box\" data-orbit=\"#orbit\" x=\"68\" y=\"48\" width=\"4\" height=\"4\" fill=\"#f00\"/>\n    </svg>`;

    const endSvg = `<svg viewBox=\"0 0 100 100\">\n      <circle id=\"orbit\" cx=\"50\" cy=\"50\" r=\"20\" stroke=\"#000\" fill=\"none\"/>\n      <rect id=\"box\" data-orbit=\"#orbit\" x=\"48\" y=\"68\" width=\"4\" height=\"4\" fill=\"#f00\"/>\n    </svg>`;

    const container = document.createElement('div');
    const controller = animateSvg({
      startSvg,
      endSvg,
      container,
      options: { duration: 100, orbitMode: 'auto+manual', layerStagger: 0, intraStagger: 0 }
    });

    controller.seek(0.5);
    const paths = Array.from(container.querySelectorAll('path'));
    const boxPath = paths.find((p) => (p.getAttribute('fill') || '').toLowerCase() === '#f00');
    expect(boxPath).toBeTruthy();

    const d = boxPath!.getAttribute('d') || '';
    const b = bboxFromPathD(d);
    // 45° 位置约在 (64,64)；直线中点约 (60,60)
    expect(b.cx).toBeGreaterThan(62);
    expect(b.cy).toBeGreaterThan(62);
  });

  it('rewrites mask/clip references to animated defs', () => {
    const startSvg = `<svg viewBox="0 0 10 10">
      <defs><clipPath id="c1"><circle cx="5" cy="5" r="2"/></clipPath></defs>
      <rect id="box" clip-path="url(#c1)" x="0" y="0" width="10" height="10" fill="red"/>
    </svg>`;
    const endSvg = `<svg viewBox="0 0 10 10">
      <defs><clipPath id="c1"><circle cx="5" cy="5" r="4"/></clipPath></defs>
      <rect id="box" clip-path="url(#c1)" x="0" y="0" width="10" height="10" fill="red"/>
    </svg>`;

    const container = document.createElement('div');
    animateSvg({ startSvg, endSvg, container, options: { duration: 100 } });
    const svg = container.querySelector('svg')!;
    const clipAttr = svg.querySelector('path')!.getAttribute('clip-path')!;
    expect(clipAttr).not.toBe('url(#c1)');
  });
});
