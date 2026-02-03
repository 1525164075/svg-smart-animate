declare module 'munkres-js' {
  type Assignment = [number, number];
  const compute: (matrix: number[][]) => Assignment[];
  export default compute;
}

declare module 'svg-path-bounds' {
  const getBounds: (d: string) => [number, number, number, number];
  export default getBounds;
}

declare module 'flubber' {
  export type Interpolator = (t: number) => string;
  export function interpolate(
    fromShape: string,
    toShape: string,
    options?: { maxSegmentLength?: number; string?: boolean }
  ): Interpolator;
}
