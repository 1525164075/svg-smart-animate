# Mask/Clip Motion + Property Timing + Group Timing Design

**Goal:** Improve Smart Animate fidelity by animating mask/clip definitions, separating property timing, and adding group-level timing to keep related elements in sync.

## Architecture Overview

### 1) Mask/Clip animation consistency
- Parse `<defs>` for `mask` and `clipPath` elements from start/end SVG.
- Normalize child shapes into path nodes and match them with the same matcher as main layers.
- Render animated mask/clip paths into a new defs block with generated ids (e.g., `__ssa_clip_*`).
- Rewrite `clip-path` / `mask` references on target elements to the new ids.
- If only one side exists, animate opacity (appear/disappear) instead of morph.

### 2) Property timing (shape vs color vs opacity)
- Split a track into timing channels: `shape`, `color`, `opacity`, `stroke`.
- Default `balanced` keeps current behavior; `shape-first` makes d/position lead color; `color-lag` slows color further.
- Uses simple time remapping per channel (no new timeline API).

### 3) Group-level timing
- Derive a `groupKey` from `pathKey` or `class`.
- Apply a group-level stagger so related elements move together (and different groups offset in time).
- Group delay is additive to layer/intra staggering.

## Data Flow
1. Parse start/end SVG → normalize nodes.
2. Extract mask/clip defs → normalize and match.
3. Build main tracks + defs tracks.
4. Render: defs tracks updated per frame; main tracks use property timing and group delay.

## Failure/Degradation Strategy
- If mask/clip parse fails → ignore and keep original refs.
- If matcher finds no good pairs → fall back to appear/disappear.
- If groupKey missing → fallback grouping by tag.

## Testing Strategy
- Unit tests for defs extraction and reference rewriting.
- Runtime tests for property timing (color lag) and group delay behavior.
