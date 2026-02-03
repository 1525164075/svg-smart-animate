/** @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import { animateSvg } from './index';

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
});
