import type { AppearStyle } from './types';
import { bboxFromPathD } from './geom';
import { shapeToPath } from './shapeToPath';

export type AppearOptions = {
  style: AppearStyle;
  /**
   * Minimum radius for collapse-to-centroid start shape.
   */
  minRadius?: number;
  /**
   * Relative radius based on min(width,height).
   */
  relativeRadius?: number;
};

export function makeAppearStartPath(endD: string, options: AppearOptions): string {
  const b = bboxFromPathD(endD);

  if (options.style === 'bbox-to-shape') {
    const rx = Math.min(b.width, b.height) * 0.1;
    return (
      shapeToPath('rect', {
        x: String(b.minX),
        y: String(b.minY),
        width: String(b.width),
        height: String(b.height),
        rx: String(rx),
        ry: String(rx)
      }) || endD
    );
  }

  // collapse-to-centroid
  const rel = options.relativeRadius ?? 0.05;
  const minR = options.minRadius ?? 0.01;
  const r = Math.max(minR, Math.min(b.width, b.height) * rel);

  return (
    shapeToPath('circle', {
      cx: String(b.cx),
      cy: String(b.cy),
      r: String(r)
    }) || endD
  );
}
