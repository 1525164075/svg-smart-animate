# svg-smart-animate

Smart Animate-like morphing between two SVG strings (start/end), plus a single-SVG appear animation via shape morphing.

## Workspace
- Library: `packages/core`
- Demo: `apps/demo`

## Dev
```bash
npm install
npm run dev
```

## Demo (Paste SVG)
- Start SVG can be empty: it will run the single-SVG “appear” animation.
- Best results if your elements have stable `id` (or `data-name`) across start/end.

## Core API

```ts
import { animateSvg, easeInOutCubic } from '@svg-smart-animate/core';

const controller = animateSvg({
  container: document.getElementById('preview')!,
  startSvg, // optional
  endSvg,
  options: {
    duration: 700,
    easing: easeInOutCubic,
    samplePoints: 128,
    appearStyle: 'collapse-to-centroid'
  }
});

controller.play();
// controller.pause();
// controller.seek(0.5);
// controller.destroy();
```

## Notes / Current Limits
- Parsing is focused on common primitives (`path/rect/circle/ellipse/line/polyline/polygon`).
- Group-level transforms/styles are not fully flattened yet (works best when transforms are on the element itself).
- Matching uses hybrid strategy: stable keys (id/data-name) first, then geometry+color Hungarian assignment.
