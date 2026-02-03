import { interpolate } from 'flubber';
import { interpolatePath } from 'd3-interpolate-path';

export type MorphOptions = {
  /**
   * Controls path segmentation density. Smaller values create smoother morphs but are heavier.
   */
  maxSegmentLength?: number;
  /**
   * Whether to treat paths as closed. Use false for open strokes like polylines/lines.
   */
  closed?: boolean;
};

export function createPathInterpolator(fromD: string, toD: string, options?: MorphOptions): (t: number) => string {
  const flubberOptions: { maxSegmentLength?: number; closed?: boolean } = {};
  if (options?.maxSegmentLength !== undefined) flubberOptions.maxSegmentLength = options.maxSegmentLength;
  if (options?.closed !== undefined) flubberOptions.closed = options.closed;
  const useD3 = typeof interpolatePath === 'function' && !options?.closed && pathCommandSignature(fromD) === pathCommandSignature(toD);
  const base = useD3 ? interpolatePath(fromD, toD) : interpolate(fromD, toD, flubberOptions);
  if (options?.closed === false) {
    return (t: number) => {
      const d = base(t);
      return d.replace(/[zZ]\s*/g, '');
    };
  }
  return base;
}

function pathCommandSignature(d: string): string {
  return d.replace(/[\s,]+/g, '').replace(/[0-9.+-]/g, '').replace(/[eE]/g, '');
}
