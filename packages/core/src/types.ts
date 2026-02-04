export type EasingFunction = (t: number) => number;

export type MatchWeights = {
  position?: number;
  size?: number;
  area?: number;
  color?: number;
  length?: number;
  group?: number;
  class?: number;
};

export type AppearStyle = 'collapse-to-centroid' | 'bbox-to-shape';
export type MorphEngine = 'auto' | 'flubber' | 'd3';
export type TimelineDriver = 'raf' | 'gsap';
export type LayerStrategy = 'area' | 'order';
export type GsapEasePreset = 'fast-out-slow-in' | 'slow-in-fast-out' | 'symmetric';
export type OrbitMode = 'off' | 'auto' | 'auto+manual';
export type OrbitDirection = 'cw' | 'ccw' | 'shortest';
export type MotionProfile = 'uniform' | 'focus-first' | 'detail-first';

export type AnimateSvgOptions = {
  duration?: number;
  easing?: EasingFunction;
  samplePoints?: number;
  matchWeights?: MatchWeights;
  appearStyle?: AppearStyle;
  morphEngine?: MorphEngine;
  timeline?: TimelineDriver;
  layerStrategy?: LayerStrategy;
  layerStagger?: number; // ms
  gsapEasePreset?: GsapEasePreset; // default: fast-out-slow-in
  intraStagger?: number; // ms, default: 18
  orbitMode?: OrbitMode; // default: auto+manual
  orbitTolerance?: number; // px, default: 6
  orbitDirection?: OrbitDirection; // default: shortest
  orbitDebug?: boolean; // default: false
  orbitSnap?: boolean; // default: true
  motionProfile?: MotionProfile; // default: uniform
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
