import type { AnimateController, AnimateSvgArgs } from './types';
import { createAnimator } from './runtime';

export type * from './types';
export * from './easing';

export function animateSvg(args: AnimateSvgArgs): AnimateController {
  return createAnimator(args);
}
