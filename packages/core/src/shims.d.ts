declare module 'munkres-js' {
  type Assignment = [number, number];
  const compute: (matrix: number[][]) => Assignment[];
  export default compute;
}

declare module 'svg-path-bounds' {
  const getBounds: (d: string) => [number, number, number, number];
  export default getBounds;
}
