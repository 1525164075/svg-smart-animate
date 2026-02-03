import { interpolate } from 'flubber';

export type MorphOptions = {
  /**
   * Controls path segmentation density. Smaller values create smoother morphs but are heavier.
   */
  maxSegmentLength?: number;
};

export function createPathInterpolator(fromD: string, toD: string, options?: MorphOptions): (t: number) => string {
  return interpolate(fromD, toD, {
    maxSegmentLength: options?.maxSegmentLength
  });
}
