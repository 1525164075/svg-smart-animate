# SVG Smart Animate Design

## Summary
Build a reusable SVG smart-animate library with a web demo. The library morphs between two SVGs (start/end) and can also animate a single SVG from an auto-generated start state (shape collapse). The demo allows users to paste SVG text and preview animations immediately.

## Goals
- Provide a simple API to animate between two SVG strings (Smart Animate-like morphing).
- Support single-SVG "appear" animation that is not just opacity (shape growth/transform).
- Ship as a reusable library and a demo site in the same repo.
- Prioritize visual quality and stability over strict minimalism.

## Non-Goals
- Perfect morphing between radically different topology without any fallback.
- Full coverage of all SVG features (e.g., foreignObject).
- Server-side rendering or Node-only runtime.

## Architecture
Monorepo (Vite + TypeScript):
- packages/core: algorithm + runtime
- apps/demo: web UI for input + preview

Pipeline:
1) Parse SVG
2) Normalize (flatten groups, apply transforms)
3) Convert all shapes to path
4) Match elements (id/name first, then geometric similarity)
5) Resample paths to fixed points and unify direction
6) Interpolate + render per frame

## API Design
```ts
animateSvg({
  startSvg?: string,
  endSvg: string,
  container: HTMLElement,
  options?: {
    duration?: number;
    easing?: (t: number) => number;
    samplePoints?: number;
    matchWeights?: {
      position?: number;
      size?: number;
      area?: number;
      color?: number;
      length?: number;
    };
    appearStyle?: 'collapse-to-centroid' | 'bbox-to-shape';
  }
}): {
  play(): void;
  pause(): void;
  seek(t: number): void; // 0..1
  destroy(): void;
}
```

If startSvg is omitted, a synthetic start is generated from endSvg.

## Normalization
- Parse SVG using svgson (AST).
- Flatten groups and apply transforms to child paths.
- Convert all supported primitives to path.
- Normalize colors to RGBA and strip unsupported nodes.

## Matching Strategy (Hybrid)
- Pass 1: exact match by id/name.
- Pass 2: auto-match remaining elements using cost matrix:
  - center distance
  - bbox size diff
  - area diff
  - fill/stroke color diff
  - path length diff
- Use Hungarian (munkres-js) or greedy fallback.
- Unmatched elements animate in/out with a simple appear/disappear transition.

## Path Alignment & Resampling
- Ensure path direction consistency using signed area.
- Resample by arc length to a fixed number of points (default 128).
- Use flubber for robust path interpolation and topology smoothing.

## Single SVG Appear Animation
Generate a start shape that preserves topology:
- collapse-to-centroid: all points collapse to centroid (or tiny radius)
- bbox-to-shape: start with bounding box path, morph into final path

## Rendering
- Use requestAnimationFrame to update t (with easing).
- Update path `d` and style attributes (fill/stroke/opacity/transform).
- Avoid DOM rebuilds; update only attributes per frame.

## Error Handling & Fallbacks
- Parse/convert failures return explicit errors.
- Unsupported nodes are skipped with warnings.
- If morph fails, fallback to scale + opacity per element (last resort).

## Performance
- Sample points configurable; lower for complex SVGs.
- Optional path simplification for large shapes.
- Cache normalized results for repeated animations.

## Demo UI
- Two textareas: Start SVG, End SVG (Start optional).
- Controls: duration, easing, sample points, appear style.
- Buttons: Play/Pause/Reset.
- Live preview area rendering the animated SVG.

## Dependencies
- svgson (SVG parsing)
- svgpath (transform application)
- flubber (path interpolation)
- munkres-js (matching)

## Testing
- Unit tests for parsing/normalization/matching/resampling.
- Snapshot tests for path interpolation stability.
- Demo fixtures with 2-3 real SVG samples.

## Milestones
1) Core pipeline + tests
2) Demo UI
3) Polish + docs
