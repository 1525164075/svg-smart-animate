# Mask/Clip Motion + Property Timing + Group Timing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mask/clip animation consistency, property-specific timing, and group-level timing to make SVG smart-animate more Figma-like.

**Architecture:** Parse mask/clip definitions into normalized nodes, match them with the same logic as main shapes, and render animated defs with new IDs referenced by tracks. Add property timing profiles to decouple shape/color/opacity timing, and compute group delays based on pathKey/class to synchronize related elements.

**Tech Stack:** TypeScript, DOMParser, svgson parsing pipeline, existing match/normalize/morph stack.

---

### Task 1: Extract mask/clip nodes from SVG defs

**Files:**
- Create: `packages/core/src/defs.ts`
- Modify: `packages/core/src/runtime.ts`
- Test: `packages/core/src/parse.test.ts`

**Step 1: Write the failing test**

```ts
it('extracts mask and clipPath nodes from defs', () => {
  const svg = `
    <svg viewBox="0 0 10 10">
      <defs>
        <clipPath id="clipA"><rect x="0" y="0" width="5" height="5"/></clipPath>
        <mask id="maskB"><circle cx="5" cy="5" r="3" fill="white"/></mask>
      </defs>
      <rect x="0" y="0" width="10" height="10"/>
    </svg>`;
  const defs = extractMaskClipDefs(svg);
  expect(defs.clips.get('clipA')?.nodes.length).toBe(1);
  expect(defs.masks.get('maskB')?.nodes.length).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w @svg-smart-animate/core test -- src/parse.test.ts`  
Expected: FAIL with "extractMaskClipDefs is not defined"

**Step 3: Write minimal implementation**

Create `packages/core/src/defs.ts` with:

```ts
export type DefsShape = {
  id: string;
  kind: 'mask' | 'clipPath';
  nodes: NormalizedPathNode[];
  attrs: Record<string, string>;
};

export function extractMaskClipDefs(svgText: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const masks = new Map<string, DefsShape>();
  const clips = new Map<string, DefsShape>();

  function collect(kind: 'mask' | 'clipPath', el: Element) {
    const id = el.getAttribute('id');
    if (!id) return;
    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const attr of ['transform', 'opacity', 'maskUnits', 'maskContentUnits', 'clipPathUnits']) {
      const val = el.getAttribute(attr);
      if (val) g.setAttribute(attr, val);
    }
    for (const child of Array.from(el.children)) g.appendChild(child.cloneNode(true));
    wrapper.appendChild(g);
    const nodes = normalizeNodes(parseSvgToNodes(wrapper.outerHTML));
    const out = { id, kind, nodes, attrs: Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])) };
    (kind === 'mask' ? masks : clips).set(id, out);
  }

  doc.querySelectorAll('mask').forEach(el => collect('mask', el));
  doc.querySelectorAll('clipPath').forEach(el => collect('clipPath', el));
  return { masks, clips };
}
```

**Step 4: Run test to verify it passes**

Run: `npm -w @svg-smart-animate/core test -- src/parse.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/defs.ts packages/core/src/parse.test.ts
git commit -m "feat: extract mask/clip defs for animation"
```

---

### Task 2: Animate mask/clip definitions and rewrite references

**Files:**
- Modify: `packages/core/src/runtime.ts`
- Test: `packages/core/src/runtime.test.ts`

**Step 1: Write the failing test**

```ts
it('rewrites mask/clip references to animated defs', () => {
  const startSvg = `<svg viewBox="0 0 10 10">
    <defs><clipPath id="c1"><circle cx="5" cy="5" r="2"/></clipPath></defs>
    <rect id="box" clip-path="url(#c1)" x="0" y="0" width="10" height="10" fill="red"/>
  </svg>`;
  const endSvg = `<svg viewBox="0 0 10 10">
    <defs><clipPath id="c1"><circle cx="5" cy="5" r="4"/></clipPath></defs>
    <rect id="box" clip-path="url(#c1)" x="0" y="0" width="10" height="10" fill="red"/>
  </svg>`;

  const container = document.createElement('div');
  animateSvg({ startSvg, endSvg, container, options: { duration: 100 }});
  const svg = container.querySelector('svg')!;
  const clipAttr = svg.querySelector('path')!.getAttribute('clip-path')!;
  expect(clipAttr).not.toBe('url(#c1)');
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: FAIL "expected url(#c1) to not be url(#c1)"

**Step 3: Write minimal implementation**

- In `runtime.ts`:
  - Call `extractMaskClipDefs` for start/end.
  - For each clip/mask id: if both sides exist, run `matchNodes` on their nodes, build tracks (like main tracks) and render into a new `<defs>` with an auto-generated id: `__ssa_clip_${id}_${uid}`.
  - If only one side exists: render its paths with opacity animated in/out.
  - Rewrite any track attributes `clip-path` / `mask` to new ids by replacing `url(#old)` → `url(#new)`.
  - Ensure defs appended once and reused across tracks.

**Step 4: Run test to verify it passes**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/runtime.ts packages/core/src/runtime.test.ts
git commit -m "feat: animate mask/clip defs and rewrite references"
```

---

### Task 3: Property timing profiles (shape/color/opacity split)

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/runtime.ts`
- Test: `packages/core/src/runtime.test.ts`

**Step 1: Write the failing test**

```ts
it('property timing profile lags color behind shape', () => {
  const startSvg = `<svg viewBox="0 0 10 10"><rect id="a" x="1" y="1" width="2" height="2" fill="#000"/></svg>`;
  const endSvg = `<svg viewBox="0 0 10 10"><rect id="a" x="7" y="7" width="2" height="2" fill="#fff"/></svg>`;
  const container = document.createElement('div');
  const controller = animateSvg({
    startSvg,
    endSvg,
    container,
    options: { duration: 100, propertyTiming: 'shape-first' }
  });
  controller.seek(0.5);
  const path = container.querySelector('path')!;
  const fill = path.getAttribute('fill')!;
  expect(fill).not.toBe('#ffffff');
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: FAIL (fill already at end)

**Step 3: Write minimal implementation**

- Add `propertyTiming?: 'balanced' | 'shape-first' | 'color-lag'` to types.
- In `runtime.ts`, compute:
  - `tShape`, `tColor`, `tOpacity`, `tStroke`
  - Use `tShape` for path interpolation, `tColor` for fill/stroke, `tOpacity` for opacity.
- Default `balanced` keeps current behavior.

**Step 4: Run test to verify it passes**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/runtime.ts packages/core/src/runtime.test.ts
git commit -m "feat: add property timing profiles"
```

---

### Task 4: Group timing based on pathKey/class

**Files:**
- Modify: `packages/core/src/runtime.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `apps/demo/src/main.ts`
- Test: `packages/core/src/runtime.test.ts`

**Step 1: Write the failing test**

```ts
it('applies group delay for same class', () => {
  const startSvg = `<svg viewBox="0 0 10 10">
    <rect class="g" x="1" y="1" width="2" height="2" fill="#000"/>
    <rect class="g" x="7" y="7" width="2" height="2" fill="#000"/>
  </svg>`;
  const endSvg = `<svg viewBox="0 0 10 10">
    <rect class="g" x="2" y="2" width="2" height="2" fill="#000"/>
    <rect class="g" x="8" y="8" width="2" height="2" fill="#000"/>
  </svg>`;
  const container = document.createElement('div');
  const controller = animateSvg({
    startSvg,
    endSvg,
    container,
    options: { duration: 100, groupStagger: 50 }
  });
  controller.seek(0.1);
  const paths = Array.from(container.querySelectorAll('path'));
  const d0 = paths[0]!.getAttribute('d')!;
  const d1 = paths[1]!.getAttribute('d')!;
  expect(d0).toBe(d1); // same group: same timing
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

- Add options: `groupStagger?: number`, `groupStrategy?: 'pathKey' | 'class' | 'auto'`.
- Compute `groupKey` from `pathKey` or `classList[0]`.
- Assign `groupDelayMs` per group; add to track delay.
- Ensure group delay doesn’t break layer/intra stagger.

**Step 4: Run test to verify it passes**

Run: `npm -w @svg-smart-animate/core test -- src/runtime.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/runtime.ts packages/core/src/types.ts apps/demo/src/main.ts packages/core/src/runtime.test.ts
git commit -m "feat: add group timing based on pathKey/class"
```

---

### Task 5: Demo wiring for new options

**Files:**
- Modify: `apps/demo/src/main.ts`
- Modify: `apps/demo/src/styles.css`

**Step 1: Write UI controls**

- Add controls for `propertyTiming`, `groupStagger`, and show `groupKey` in match panel rows.

**Step 2: Run demo**

Run: `npm run dev`  
Expected: Controls visible, match panel updates.

**Step 3: Commit**

```bash
git add apps/demo/src/main.ts apps/demo/src/styles.css
git commit -m "feat: wire demo controls for timing/grouping"
```

---

### Task 6: Full test + cleanup

**Files:**
- Test: `packages/core/src/*.test.ts`

**Step 1: Run full tests**

Run: `npm test`  
Expected: All tests pass

**Step 2: Final commit (if needed)**

```bash
git status -sb
```

