# SVG Smart Animate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable TS library that smart-animates between two SVG strings (start/end) and supports single-SVG “appear” via shape morphing, plus a web demo to paste SVG text and preview the animation.

**Architecture:** NPM workspaces with `packages/core` (library) and `apps/demo` (Vite web demo). Core does parse/normalize → match → morph, and exposes a small controller API. Demo imports the core package and provides textarea inputs + playback controls.

**Tech Stack:** TypeScript, Vite, Vitest, svgson, svgpath, flubber, munkres-js.

---

### Task 1: Initialize Workspace (NPM workspaces)

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `README.md`

**Step 1: Write the files (no code logic yet)**
- Root `package.json` with workspaces: `packages/*`, `apps/*`.
- `tsconfig.base.json` with strict TS settings.

**Step 2: Install tooling deps**
Run: `npm install -D typescript vite vitest @vitest/ui`
Expected: install succeeds.

**Step 3: Commit**
Run:
```bash
git add package.json tsconfig.base.json README.md
git commit -m "chore: init workspace"
```

---

### Task 2: Create `@svg-smart-animate/core` package skeleton

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/vite.config.ts`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/types.ts`

**Step 1: Write failing test for export surface**
- Create: `packages/core/src/index.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { animateSvg } from './index';

describe('core exports', () => {
  it('exports animateSvg', () => {
    expect(typeof animateSvg).toBe('function');
  });
});
```

**Step 2: Run test (should fail)**
Run: `npm -w @svg-smart-animate/core test`
Expected: FAIL (module not found / missing scripts) until package scripts exist.

**Step 3: Minimal implementation to pass**
- Add package scripts + minimal `animateSvg` stub.

**Step 4: Run tests (should pass)**
Run: `npm -w @svg-smart-animate/core test`
Expected: PASS.

**Step 5: Commit**
```bash
git add packages/core
git commit -m "feat(core): scaffold library package"
```

---

### Task 3: SVG parsing + normalization (paths only first)

**Files:**
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/parse.ts`
- Create: `packages/core/src/normalize.ts`
- Create: `packages/core/src/fixtures/simple.ts`
- Create: `packages/core/src/parse.test.ts`

**Step 1: Write failing test for parsing `<path>`**
```ts
import { describe, it, expect } from 'vitest';
import { parseSvgToNodes } from './parse';

const svg = `<svg viewBox="0 0 100 100"><path id="p" d="M10 10 L90 10" fill="none" stroke="black"/></svg>`;

describe('parseSvgToNodes', () => {
  it('extracts path nodes with id and d', async () => {
    const nodes = await parseSvgToNodes(svg);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('p');
    expect(nodes[0].d).toContain('M');
  });
});
```

**Step 2: Run test (should fail)**
Run: `npm -w @svg-smart-animate/core test`
Expected: FAIL until parse/normalize exists.

**Step 3: Minimal implementation**
- Use `svgson` to parse.
- Collect `<path>` nodes (ignore others for now).

**Step 4: Run tests (should pass)**

**Step 5: Commit**
```bash
git add packages/core/src/parse* packages/core/src/normalize* packages/core/src/fixtures
git commit -m "feat(core): parse and normalize basic paths"
```

---

### Task 4: Shape-to-path conversion + transform application

**Files:**
- Modify: `packages/core/src/normalize.ts`
- Create: `packages/core/src/shapeToPath.ts`
- Create: `packages/core/src/transform.ts`
- Create: `packages/core/src/shapeToPath.test.ts`

**Step 1: Write failing tests for converting rect/circle to path**
- Rect → path d contains 4 corners.
- Circle → path uses arc commands.

**Step 2: Implement minimal conversion**
- Convert: rect/circle/ellipse/line/polyline/polygon to path.
- Use `svgpath` to apply transform matrices to the resulting `d`.

**Step 3: Run tests**

**Step 4: Commit**
```bash
git add packages/core/src/shapeToPath* packages/core/src/transform* packages/core/src/normalize.ts
git commit -m "feat(core): convert primitives to paths and apply transforms"
```

---

### Task 5: Element matching (hybrid)

**Files:**
- Create: `packages/core/src/match.ts`
- Create: `packages/core/src/geom.ts`
- Create: `packages/core/src/match.test.ts`

**Step 1: Write failing tests**
- id/name match wins.
- remaining nodes match by nearest center.

**Step 2: Implement**
- Build cost matrix using bbox center/size/area + color distance.
- Use `munkres-js` for optimal assignment.

**Step 3: Run tests**

**Step 4: Commit**
```bash
git add packages/core/src/match* packages/core/src/geom* 
# plus any helper files

git commit -m "feat(core): hybrid element matching"
```

---

### Task 6: Path morphing + single SVG appear

**Files:**
- Create: `packages/core/src/morph.ts`
- Create: `packages/core/src/appear.ts`
- Create: `packages/core/src/morph.test.ts`

**Step 1: Write failing tests**
- flubber interpolator returns valid path for t=0 and t=1.
- appear generator returns a start path different from end.

**Step 2: Implement**
- Use `flubber.interpolate(fromD, toD, { maxSegmentLength })`.
- For appear: collapse-to-centroid by sampling points and collapsing.

**Step 3: Run tests**

**Step 4: Commit**
```bash
git add packages/core/src/morph* packages/core/src/appear*
git commit -m "feat(core): path morphing and appear start generation"
```

---

### Task 7: Runtime animator (DOM rendering)

**Files:**
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/runtime.ts`
- Create: `packages/core/src/easing.ts`

**Step 1: Write failing test for controller basics (seek)**
- A small unit test that calling `seek(0)` sets d to start, `seek(1)` sets d to end.

**Step 2: Implement runtime**
- Create an `<svg>` in `container`.
- Create `<path>` elements for each matched pair.
- On each frame, update `d` and styles.
- Provide controller: play/pause/seek/destroy.

**Step 3: Run tests**

**Step 4: Commit**
```bash
git add packages/core/src/index.ts packages/core/src/runtime* packages/core/src/easing*
git commit -m "feat(core): DOM runtime animator"
```

---

### Task 8: Demo app (paste SVG and preview)

**Files:**
- Create: `apps/demo/package.json`
- Create: `apps/demo/vite.config.ts`
- Create: `apps/demo/index.html`
- Create: `apps/demo/src/main.ts`
- Create: `apps/demo/src/styles.css`

**Step 1: Build minimal UI**
- Two textareas (start/end), start optional.
- Controls: duration, easing, sample points, appear style.
- Buttons: Play/Pause/Reset.
- Preview container.

**Step 2: Wire to core**
- On Run/Play: call `animateSvg`.

**Step 3: Manual verification**
Run: `npm -w @svg-smart-animate/demo dev`
Expected: browser shows UI, morph animation runs.

**Step 4: Commit**
```bash
git add apps/demo
# plus any shared root config

git commit -m "feat(demo): add paste-and-preview web demo"
```

---

### Task 9: Build outputs + docs

**Files:**
- Modify: `README.md`
- Modify: `packages/core/package.json`

**Step 1: Add usage docs**
- Example code snippet for importing the library.
- Demo instructions.

**Step 2: Verify builds**
Run:
- `npm -w @svg-smart-animate/core run build`
- `npm -w @svg-smart-animate/demo run build`
Expected: build outputs created.

**Step 3: Commit**
```bash
git add README.md packages/core/package.json

git commit -m "docs: add usage and build instructions"
```
