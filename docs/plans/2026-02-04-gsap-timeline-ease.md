# GSAP Timeline Ease Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

**Goal:** Make GSAP driver feel distinct from RAF by driving per-element tweens with A/B/C ease presets and layer + intra-layer staggering.

**Architecture:** Keep RAF path as a single global progress renderer. In GSAP mode, build a timeline with one tween per track that updates that track’s local progress (0..1), applying per-track ease and stagger. Reuse the existing path interpolation and attribute rendering logic per track.

**Tech Stack:** TypeScript, GSAP, Vitest (jsdom).

---

### Task 1: Add failing test that proves GSAP uses non-linear local ease

**Files:**
- Modify: `packages/core/src/runtime.test.ts`

**Step 1: Write the failing test**

Add a test asserting GSAP ease A (“fast-out-slow-in”) moves the shape beyond linear midpoint at `seek(0.5)`.

```ts
it('gsap ease preset A is non-linear at mid-progress', () => {
  const startSvg = `<svg viewBox="0 0 100 100"><path id="p" d="M0 0 H10 V10 H0 Z" fill="#ff0000"/></svg>`;
  const endSvg = `<svg viewBox="0 0 100 100"><path id="p" d="M50 0 H60 V10 H50 Z" fill="#ff0000"/></svg>`;

  const container = document.createElement('div');
  const controller = animateSvg({
    startSvg,
    endSvg,
    container,
    options: { duration: 100, timeline: 'gsap', gsapEasePreset: 'fast-out-slow-in' }
  });

  controller.seek(0.5);
  const path = container.querySelector('path');
  expect(path).toBeTruthy();

  const d = path!.getAttribute('d') || '';
  const m = d.match(/M([0-9.\-]+)\s/);
  const x = m ? Number.parseFloat(m[1]!) : 0;
  // Linear midpoint would be 25. With ease-out, it should be > 25.
  expect(x).toBeGreaterThan(25);
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm -w @svg-smart-animate/core test -- runtime.test.ts
```
Expected: FAIL because GSAP currently uses global linear progress.

---

### Task 2: Add new GSAP options to types

**Files:**
- Modify: `packages/core/src/types.ts`

**Step 1: Write the failing test**

No new test needed beyond Task 1 (fails until options are wired).

**Step 2: Minimal implementation**

Add:
```ts
export type GsapEasePreset = 'fast-out-slow-in' | 'slow-in-fast-out' | 'symmetric';
```

Extend `AnimateSvgOptions`:
```ts
gsapEasePreset?: GsapEasePreset; // default: fast-out-slow-in
intraStagger?: number; // ms, default: 18
```

**Step 3: Run tests**
Same as Task 1; still expected FAIL.

---

### Task 3: Implement GSAP per-track timeline + A/B/C ease presets

**Files:**
- Modify: `packages/core/src/runtime.ts`

**Step 1: Write the minimal implementation**

Changes:
1) Add `resolveGsapEase(preset)` mapping:
   - `fast-out-slow-in` → `'power3.out'`
   - `slow-in-fast-out` → `'power3.in'`
   - `symmetric` → `'power2.inOut'`
2) Add `renderTrack(tr, local)` helper (extract from current `renderProgress`).
3) For `driver === 'gsap'`:
   - Create `gsap.timeline({ paused: true })`.
   - For each track, compute `startTimeMs = tr.delayMs + tr.intraDelay`.
   - Use `gsap.to(localState, { t: 1, duration: duration/1000, ease: resolveGsapEase(...), onUpdate: () => renderTrack(tr, localState.t) }, startTimeMs/1000)`.
   - Set `totalDuration = duration + maxDelay + maxIntra` and use it for RAF only; GSAP timeline duration is derived automatically but `seek` should map `progress` to `timeline.progress()`.
4) Add intra-layer staggering:
   - Group tracks by `layer` and sort by `order`.
   - `intraStagger = options?.intraStagger ?? 18`.
   - `tr.intraDelay = indexInLayer * intraStagger`.

**Step 2: Run tests**
```bash
npm -w @svg-smart-animate/core test -- runtime.test.ts
```
Expected: PASS (new test should go green).

---

### Task 4: Expose GSAP ease preset and intra-stagger in demo UI

**Files:**
- Modify: `apps/demo/src/main.ts`

**Step 1: Write the failing test**
No test required (demo-only UI change).

**Step 2: Minimal implementation**

Add controls:
- Select: “GSAP节奏” with A/B/C options mapped to preset values.
- Slider or number input: “层内错峰 (ms)” default 18.

Wire into `animateSvg` call:
```ts
options: {
  ...,
  timeline: 'gsap',
  gsapEasePreset,
  intraStagger
}
```

**Step 3: Manual check**
Run demo and verify GSAP mode visibly differs from RAF.

---

### Task 5: Clean up and verify

**Files:**
- None

**Step 1: Run full test suite**
```bash
npm test
```
Expected: PASS.

**Step 2: Commit**
```bash
git add packages/core/src/runtime.ts packages/core/src/types.ts packages/core/src/runtime.test.ts apps/demo/src/main.ts
git commit -m "feat: gsap per-track easing presets"
```

---

Plan complete and saved to `docs/plans/2026-02-04-gsap-timeline-ease.md`.

Two execution options:

1. Subagent-Driven (this session) – I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) – Open new session with executing-plans, batch execution with checkpoints

Which approach?
