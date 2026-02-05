# svg-smart-animate

[中文](README.md) | [English](README.en.md)

Smart Animate-like SVG morphing on the web. Supports Start/End transitions, single‑SVG appear animation, property timing and custom curves.

## Quick Start

```bash
npm install
npm run dev
```

## Features

- Start/End SVG morph + single SVG appear
- Auto matching: id/data-name first, geometry+color Hungarian fallback
- Morph engines: `auto` (d3 if compatible, else flubber), `flubber`, `d3`
- Property timing separation (shape/color/opacity/stroke)
- **Per‑property cubic‑bezier curves** (standard x→y time mapping)
- GSAP or RAF timeline driver
- Orbit motion (auto or `data-orbit`)
- Match visualizer panel (debug)

## Install (for other projects)

```bash
npm install @marcodai/svg-smart-animate-core
```

```ts
import { animateSvg } from '@marcodai/svg-smart-animate-core';
```

## Basic Usage

```ts
import { animateSvg, easeInOutCubic } from '@marcodai/svg-smart-animate-core';

const controller = animateSvg({
  container: document.getElementById('preview')!,
  startSvg, // optional
  endSvg,   // required
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

## Demo

- Start SVG can be empty (single‑SVG appear)
- Add `id` or `data-name` for more stable matching
- Toggle “Custom curves” to edit per‑property curves

Run demo:
```bash
npm install
npm run dev
```

## Demo Assets

- Screen recording (.mov):
  [Recording](<apps/demo/assets/录屏2026-02-05 17.28.35.mov>)
- Full page screenshot:
  ![Demo Screenshot](<apps/demo/assets/截屏2026-02-05 17.33.17.png>)

## Notes / Limitations

- Focused on common primitives (`path/rect/circle/ellipse/line/polyline/polygon`)
- Group-level transform/style not fully expanded (prefer transforms on elements)
- Complex masks/filters may still have edge‑case deviations
