# Property Curve Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visual cubic-bezier editor and wire per-property curves (shape/color/opacity/stroke) into core animation timing using **standard cubic-bezier time mapping** (x is time, y is progress).

**Architecture:** Provide a Bezier curve data type and evaluator in core; expose `propertyCurves` option that overrides `propertyTiming`. Demo uses a reusable curve editor component to edit curves and pass them into `animateSvg`.

**Tech Stack:** TypeScript, DOM/SVG UI, vitest tests.

---

### Task 1: Core bezier evaluator + types

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/bezier.ts`
- Test: `packages/core/src/bezier.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { evalBezier } from './bezier';

describe('evalBezier', () => {
  it('returns endpoints and behaves like linear for (0,0,1,1)', () => {
    const linear = { x1: 0, y1: 0, x2: 1, y2: 1 };
    expect(evalBezier(0, linear)).toBe(0);
    expect(evalBezier(1, linear)).toBe(1);
    expect(evalBezier(0.5, linear)).toBeCloseTo(0.5, 4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w @svg-smart-animate/core test -- src/bezier.test.ts`  
Expected: FAIL "Cannot find module './bezier'"

**Step 3: Write minimal implementation**

Implement standard cubic‑bezier time mapping (x is time, solve for y):

```ts
export type BezierCurve = { x1: number; y1: number; x2: number; y2: number };

// Use Newton-Raphson with binary search fallback to solve x(t)=input, then return y(t).
export function evalBezier(t: number, c: BezierCurve): number {
  // clamp input
  const x = Math.min(1, Math.max(0, t));
  if (x === 0 || x === 1) return x;
  // ... implement cubic bezier x/y + derivative
}
```

**Step 4: Run test to verify it passes**

Run: `npm -w @svg-smart-animate/core test -- src/bezier.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/bezier.ts packages/core/src/bezier.test.ts packages/core/src/types.ts
git commit -m "feat: add bezier evaluator and curve types"
```

---

### Task 2: Wire propertyCurves into runtime timing

**Files:**
- Modify: `packages/core/src/runtime.ts`
- Modify: `packages/core/src/types.ts`
- Test: `packages/core/src/runtime.test.ts`

**Step 1: Write the failing test**

```ts
it('propertyCurves overrides propertyTiming for color', () => {
  const startSvg = `<svg viewBox="0 0 10 10"><rect id="a" x="1" y="1" width="2" height="2" fill="#000"/></svg>`;
  const endSvg = `<svg viewBox="0 0 10 10"><rect id="a" x="7" y="7" width="2" height="2" fill="#fff"/></svg>`;
  const container = document.createElement('div');
  const controller = animateSvg({
    startSvg,
    endSvg,
    container,
    options: {
      duration: 100,
      propertyTiming: 'shape-first',
      propertyCurves: { color: { x1: 0, y1: 0, x2: 1, y2: 1 } }
    }
  });
  controller.seek(0.5);
  const path = Array.from(container.querySelectorAll('path')).find((p) => (p.getAttribute('fill') || '') !== 'none')!;
  const fill = path.getAttribute('fill') || '';
  // linear curve -> midway should be ~gray, not fully white
  expect(fill.toLowerCase()).not.toBe('#ffffff');
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: FAIL (curve ignored)

**Step 3: Write minimal implementation**

- Add `propertyCurves?: { shape?: BezierCurve; color?: BezierCurve; opacity?: BezierCurve; stroke?: BezierCurve }` in types.
- In `renderTrack`, if curve exists for channel, use `evalBezier(t, curve)` in place of timing map.
- If curve missing, fallback to existing `propertyTiming`.

**Step 4: Run test to verify it passes**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/runtime.ts packages/core/src/types.ts packages/core/src/runtime.test.ts
git commit -m "feat: add per-property curves"
```

---

### Task 3: Demo curve editor component

**Files:**
- Create: `apps/demo/src/curveEditor.ts`
- Modify: `apps/demo/src/main.ts`
- Modify: `apps/demo/src/styles.css`

**Step 1: Implement minimal editor**

- SVG grid (100x100), cubic curve path, two draggable control points.
- Numeric inputs for x1/y1/x2/y2.
- `onChange(curve)` callback.

**Step 2: Wire demo panel**

- Add “启用自定义曲线” toggle.
- When enabled, show 4 editors (shape/color/opacity/stroke).
- Build `propertyCurves` from editors and pass to `animateSvg`.

**Step 3: Commit**

```bash
git add apps/demo/src/curveEditor.ts apps/demo/src/main.ts apps/demo/src/styles.css
git commit -m "feat: add curve editor UI for property curves"
```

---

### Task 4: Full test + cleanup

**Step 1: Run full tests**

Run: `npm test`  
Expected: All tests pass

**Step 2: Final status check**

Run: `git status -sb`
