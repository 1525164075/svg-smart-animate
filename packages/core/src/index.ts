import type { AnimateController, AnimateSvgArgs } from './types';

export type * from './types';

export function animateSvg(_args: AnimateSvgArgs): AnimateController {
  // Stub. Real implementation comes in later tasks.
  return {
    play() {},
    pause() {},
    seek() {},
    destroy() {}
  };
}
