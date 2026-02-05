# Curve Editor (Tweakpane) + Timeline Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the demo’s custom curve editor with Tweakpane’s cubic‑bezier plugin and add a timeline slider that auto-follows playback.

**Architecture:** Extend core animation options with `onProgress` so UI can follow playback. In the demo, mount a Tweakpane curve panel bound to `curveState` and add a slider + time label that drives `seek()` and listens to `onProgress` updates.

**Tech Stack:** TypeScript, Vite, Tweakpane, Vitest, SVG DOM.

---

### Task 1: Add a failing test for `onProgress`

**Files:**
- Modify: `packages/core/src/runtime.test.ts`
- Test: `packages/core/src/runtime.test.ts`

**Step 1: Write the failing test**

Add this test near other runtime tests:

```ts
  it('calls onProgress when seeking', () => {
    const startSvg = `<svg viewBox="0 0 10 10"><path d="M0 0 H2 V2 H0 Z"/></svg>`;
    const endSvg = `<svg viewBox="0 0 10 10"><path d="M8 8 H10 V10 H8 Z"/></svg>`;

    const container = document.createElement('div');
    const calls: number[] = [];

    const controller = animateSvg({
      startSvg,
      endSvg,
      container,
      options: { duration: 100, onProgress: (t) => calls.push(t) }
    });

    controller.seek(0.25);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBeCloseTo(0.25, 3);
  });
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm -w @marcodai/svg-smart-animate-core test -- runtime.test.ts -t "onProgress"
```

Expected: FAIL because `onProgress` does not exist / is never called.

---

### Task 2: Implement `onProgress` in core

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/runtime.ts`
- Test: `packages/core/src/runtime.test.ts`

**Step 1: Add option type**

In `packages/core/src/types.ts`, extend `AnimateSvgOptions`:

```ts
  onProgress?: (t: number) => void;
```

**Step 2: Implement progress callbacks**

In `packages/core/src/runtime.ts`:

- Read `onProgress` from options, create helper:

```ts
  const onProgress = options?.onProgress;
  const notifyProgress = (p: number) => {
    if (onProgress) onProgress(clamp01(p));
  };
```

- Call `notifyProgress(p)` at end of `renderProgress(p)`.
- Call `notifyProgress(p)` at end of `renderGsapProgress(p)`.
- In `ensureGsap()`, add:

```ts
    gsapTimeline.eventCallback('onUpdate', () => {
      notifyProgress(gsapTimeline!.progress());
    });
```

**Step 3: Run the test again**

```bash
npm -w @marcodai/svg-smart-animate-core test -- runtime.test.ts -t "onProgress"
```
Expected: PASS.

**Step 4: Run full core tests**

```bash
npm -w @marcodai/svg-smart-animate-core test
```
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/runtime.ts packages/core/src/runtime.test.ts

git commit -m "feat(core): add onProgress callback"
```

---

### Task 3: Add Tweakpane cubic-bezier dependency

**Files:**
- Modify: `apps/demo/package.json`
- Modify: `package-lock.json`

**Step 1: Add dependency**

```bash
npm install -w @svg-smart-animate/demo @tweakpane/plugin-cubic-bezier
```

**Step 2: Commit**

```bash
git add apps/demo/package.json package-lock.json

git commit -m "chore(demo): add tweakpane cubic-bezier plugin"
```

---

### Task 4: Replace curve editor UI with Tweakpane plugin

**Files:**
- Modify: `apps/demo/src/main.ts`
- Modify: `apps/demo/src/styles.css`
- Delete: `apps/demo/src/curveEditor.ts`

**Step 1: Update imports and state**

In `apps/demo/src/main.ts`:
- Remove `createCurveEditor` import.
- Import Tweakpane + plugin:

```ts
import { Pane } from 'tweakpane';
import * as CubicBezierPlugin from '@tweakpane/plugin-cubic-bezier';
```

**Step 2: Create Tweakpane inside curvePanel**

Replace the `curveGrid` + `createCurveEditor` block with:

```ts
const curvePanel = el('div', 'curvePanel');
left.appendChild(curvePanel);
const curveTitle = el('div', 'curvePanelTitle');
curveTitle.textContent = '属性曲线';
curvePanel.appendChild(curveTitle);

const curvePaneWrap = el('div', 'curvePaneWrap');
curvePanel.appendChild(curvePaneWrap);

const linearCurve: BezierCurve = { x1: 0, y1: 0, x2: 1, y2: 1 };
const curveState = {
  shape: { ...linearCurve },
  color: { ...linearCurve },
  opacity: { ...linearCurve },
  stroke: { ...linearCurve }
};

const pane = new Pane({ container: curvePaneWrap });
pane.registerPlugin(CubicBezierPlugin);

const addCurve = (title: string, key: keyof typeof curveState) => {
  const folder = pane.addFolder({ title });
  folder.addBinding(curveState, key, { view: 'cubicBezier' }).on('change', (ev) => {
    curveState[key] = ev.value as BezierCurve;
  });
};

addCurve('形状', 'shape');
addCurve('颜色', 'color');
addCurve('透明度', 'opacity');
addCurve('描边', 'stroke');
```

**Step 3: Keep toggle behavior**

Keep the existing `curveToggleInput` and `syncCurvePanel()` logic to show/hide `curvePanel`.

**Step 4: Update styles**

In `apps/demo/src/styles.css`, add minimal Tweakpane overrides scoped to `.curvePanel`:

```css
.curvePanel .tp-dfwv {
  background: transparent;
}
.curvePanel .tp-rotv {
  background: rgba(255,255,255,0.03);
}
.curvePanel .tp-lblv_v,
.curvePanel .tp-lblv_l {
  color: var(--text);
}
```

**Step 5: Delete unused editor**

```bash
rm apps/demo/src/curveEditor.ts
```

**Step 6: Commit**

```bash
git add apps/demo/src/main.ts apps/demo/src/styles.css apps/demo/src/curveEditor.ts

git commit -m "feat(demo): replace curve editor with tweakpane"
```

---

### Task 5: Add timeline slider (auto-follow)

**Files:**
- Modify: `apps/demo/src/main.ts`
- Modify: `apps/demo/src/styles.css`

**Step 1: Add UI controls**

Insert after the existing playback buttons:

```ts
const timelineBox = el('div', 'timelineBox');
const timelineLabel = el('div', 'timelineLabel');
const timelineValue = el('span', 'timelineValue');

const timelineInput = document.createElement('input');
 timelineInput.type = 'range';
 timelineInput.min = '0';
 timelineInput.max = '1000';
 timelineInput.value = '0';
 timelineInput.className = 'timelineSlider';

 timelineLabel.innerHTML = '时间轴 '; // then append timelineValue
 timelineLabel.appendChild(timelineValue);
 timelineBox.appendChild(timelineLabel);
 timelineBox.appendChild(timelineInput);
 rightHeader.appendChild(timelineBox); // or below header
```

**Step 2: Add logic**

```ts
let isScrubbing = false;
const updateTimelineUI = (p: number) => {
  const clamped = Math.max(0, Math.min(1, p));
  timelineInput.value = String(Math.round(clamped * 1000));
  const ms = Math.round(clamped * Number.parseInt(durationInput.value || '700', 10));
  timelineValue.textContent = `(${ms}ms)`;
};

 timelineInput.addEventListener('input', () => {
   isScrubbing = true;
   controller?.pause();
   const p = Number(timelineInput.value) / 1000;
   controller?.seek(p);
   updateTimelineUI(p);
 });

 timelineInput.addEventListener('change', () => {
   isScrubbing = false;
 });
```

In `run()` pass `onProgress`:

```ts
  const onProgress = (p: number) => {
    if (!isScrubbing) updateTimelineUI(p);
  };
```

Then include in options:

```ts
  onProgress,
```

Finally, after `controller.seek(0)` call `updateTimelineUI(0)`.

**Step 3: Styles**

Add CSS:

```css
.timelineBox { display: flex; flex-direction: column; gap: 6px; }
.timelineLabel { font-size: 12px; color: var(--muted); }
.timelineSlider { width: 100%; }
```

**Step 4: Commit**

```bash
git add apps/demo/src/main.ts apps/demo/src/styles.css

git commit -m "feat(demo): add timeline slider"
```

---

### Task 6: Manual verification

**Step 1: Run demo**

```bash
npm -w @svg-smart-animate/demo run dev
```

Check:
- 曲线面板显示为 Tweakpane cubic-bezier。
- 拖动曲线能改变动画节奏。
- 时间轴拖动能定位进度，播放时自动跟随。

---

### Task 7: Final cleanup

**Step 1: Status check**

```bash
git status -sb
```

**Step 2: Optional consolidated commit**

If you prefer fewer commits, squash locally before push.
