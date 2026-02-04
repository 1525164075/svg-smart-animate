# svg-smart-animate

Smart Animate-like morphing between two SVG strings (start/end), plus a single-SVG appear animation via shape morphing.

## Workspace
- Library: `packages/core`
- Demo: `apps/demo`

## Quick Start
```bash
npm install
npm run dev
```

## Features
- Start/End SVG morphing + single-SVG appear animation
- Auto match by id/data-name + geometry/color Hungarian assignment
- Morph engines: `auto` (d3 when commands match), `flubber`, `d3`
- Per-property timing separation (shape/color/opacity/stroke)
- **Per-property cubic-bezier curves** (standard x→y mapping)
- GSAP or RAF timeline driver
- Orbit motion (auto or `data-orbit` binding)
- Match visualization panel (debug)

## Demo (Paste SVG)
- Start SVG can be empty: it will run the single-SVG “appear” animation.
- Best results if your elements have stable `id` (or `data-name`) across start/end.
- 曲线编辑器：勾选“自定义曲线”可编辑形状/颜色/透明度/描边的 cubic-bezier。

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
    appearStyle: 'collapse-to-centroid',
    propertyTiming: 'shape-first'
  }
});

controller.play();
// controller.pause();
// controller.seek(0.5);
// controller.destroy();
```

## Property Curves (cubic-bezier)

```ts
const controller = animateSvg({
  container,
  startSvg,
  endSvg,
  options: {
    propertyTiming: 'shape-first',
    propertyCurves: {
      shape: { x1: 0.2, y1: 0, x2: 0.8, y2: 1 },
      color: { x1: 0, y1: 0, x2: 1, y2: 1 }
    }
  }
});
```

## Configuration (Selected)

| Option | Description | Default |
|--------|-------------|---------|
| duration | Total duration (ms) | 600 |
| easing | Global easing (RAF only) | linear |
| morphEngine | `auto` \| `flubber` \| `d3` | auto |
| timeline | `raf` \| `gsap` | raf |
| gsapEasePreset | `fast-out-slow-in` \| `slow-in-fast-out` \| `symmetric` | fast-out-slow-in |
| appearStyle | `collapse-to-centroid` \| `bbox-to-shape` | collapse-to-centroid |
| propertyTiming | `balanced` \| `shape-first` \| `color-lag` | balanced |
| propertyCurves | Per-property cubic-bezier override | — |
| layerStagger | Layer delay (ms) | 70 |
| intraStagger | Intra-layer delay (ms) | 18 |
| groupStrategy | `auto` \| `pathKey` \| `class` | auto |
| groupStagger | Group delay (ms) | 0 |
| orbitMode | `off` \| `auto` \| `auto+manual` | auto+manual |
| orbitTolerance | Orbit snap tolerance (px) | 6 |

## Notes / Current Limits
- Parsing is focused on common primitives (`path/rect/circle/ellipse/line/polyline/polygon`).
- Group-level transforms/styles are not fully flattened yet (works best when transforms are on the element itself).
- Matching uses hybrid strategy: stable keys (id/data-name) first, then geometry+color Hungarian assignment.
