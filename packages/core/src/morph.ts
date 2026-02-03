import { interpolate } from 'flubber';

export type MorphOptions = {
  /**
   * Controls path segmentation density. Smaller values create smoother morphs but are heavier.
   */
  maxSegmentLength?: number;
};

export function createPathInterpolator(fromD: string, toD: string, options?: MorphOptions): (t: number) => string {
  const flubberOptions: { maxSegmentLength?: number } = {};
  if (options?.maxSegmentLength !== undefined) flubberOptions.maxSegmentLength = options.maxSegmentLength;
  return interpolate(fromD, toD, flubberOptions);
}
