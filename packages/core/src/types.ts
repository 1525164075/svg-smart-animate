export type EasingFunction = (t: number) => number;

export type MatchWeights = {
  position?: number;
  size?: number;
  area?: number;
  color?: number;
  length?: number;
};

export type AppearStyle = 'collapse-to-centroid' | 'bbox-to-shape';
export type MorphEngine = 'auto' | 'flubber' | 'd3';

export type AnimateSvgOptions = {
  duration?: number;
  easing?: EasingFunction;
  samplePoints?: number;
  matchWeights?: MatchWeights;
  appearStyle?: AppearStyle;
  morphEngine?: MorphEngine;
};

export type AnimateSvgArgs = {
  startSvg?: string;
  endSvg: string;
  container: HTMLElement;
  options?: AnimateSvgOptions;
};

export type AnimateController = {
  play(): void;
  pause(): void;
  seek(t: number): void; // 0..1
  destroy(): void;
};
