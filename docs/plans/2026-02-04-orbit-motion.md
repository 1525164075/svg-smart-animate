# Orbit Path Motion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add “沿形状轨迹移动”能力：自动识别轨迹 + 手动 data-orbit 覆盖，并在动画中让元素沿轨迹位移而非直线位移。

**Architecture:** 在 runtime 生成 tracks 后，基于 endSvg 优先（否则 startSvg）提取轨迹候选；为每条 track 绑定 orbit（手动优先，自动兜底）。渲染时仍走原路径形变，但对绑定轨迹的 track 做平移，使其中心沿轨迹点移动。

**Tech Stack:** TypeScript, svg-path-properties, svgpath, Vitest (jsdom).

---

### Task 1: 写失败测试（轨迹位移非直线）

**Files:**
- Modify: `packages/core/src/runtime.test.ts`

**Step 1: Write the failing test**

添加测试：圆轨迹 + 小方块，从圆右侧移动到圆下侧，`seek(0.5)` 时中心点应接近 45° 位置，而不是直线中点。

```ts
it('orbit motion moves along arc instead of straight line', () => {
  const startSvg = `<svg viewBox="0 0 100 100">
    <circle id="orbit" cx="50" cy="50" r="20" stroke="#000" fill="none"/>
    <rect id="box" data-orbit="#orbit" x="68" y="48" width="4" height="4" fill="#f00"/>
  </svg>`;

  const endSvg = `<svg viewBox="0 0 100 100">
    <circle id="orbit" cx="50" cy="50" r="20" stroke="#000" fill="none"/>
    <rect id="box" data-orbit="#orbit" x="48" y="68" width="4" height="4" fill="#f00"/>
  </svg>`;

  const container = document.createElement('div');
  const controller = animateSvg({
    startSvg,
    endSvg,
    container,
    options: { duration: 100, orbitMode: 'auto+manual' }
  });

  controller.seek(0.5);
  const path = container.querySelector('path');
  expect(path).toBeTruthy();

  const d = path!.getAttribute('d') || '';
  const b = bboxFromPathD(d);
  // 45° 位置大约在 (64,64)；直线中点约 (60,60)
  expect(b.cx).toBeGreaterThan(62);
  expect(b.cy).toBeGreaterThan(62);
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm -w @svg-smart-animate/core test -- runtime.test.ts
```
Expected: FAIL（目前仍是直线位移）。

---

### Task 2: 添加 Orbit 相关类型

**Files:**
- Modify: `packages/core/src/types.ts`

**Step 1: Write the failing test**

不新增测试（依赖 Task 1 失败用例）。

**Step 2: Minimal implementation**

新增类型与选项：
```ts
export type OrbitMode = 'off' | 'auto' | 'auto+manual';
export type OrbitDirection = 'cw' | 'ccw' | 'shortest';
```

在 `AnimateSvgOptions` 添加：
```ts
orbitMode?: OrbitMode; // default: auto+manual
orbitTolerance?: number; // px, default: 6
orbitDirection?: OrbitDirection; // default: shortest
```

**Step 3: Run tests**
```bash
npm -w @svg-smart-animate/core test -- runtime.test.ts
```
Expected: still FAIL.

---

### Task 3: 新建轨迹识别与绑定工具

**Files:**
- Create: `packages/core/src/orbit.ts`

**Step 1: Write minimal implementation**

实现：
- `collectOrbitCandidates(nodes: NormalizedPathNode[]): OrbitCandidate[]`
  - 只取闭合图形（circle/ellipse/rect/path）；优先 stroke 可见；计算 bbox/center/area
- `resolveOrbitBinding(trackAttrs, candidates, options, startCenter, endCenter)`
  - 手动 `data-orbit` 优先；自动模式根据中心到轨迹距离判定
- `closestPointOnPath(d, point)` 通过 `svg-path-properties` 采样（例如 120 点），输出 `t` (0..1) 与距离
- `computeOrbitPoint(candidate, t)` 返回轨迹点

**Step 2: No tests**
依赖 runtime 测试覆盖。

---

### Task 4: Runtime 接入轨迹位移

**Files:**
- Modify: `packages/core/src/runtime.ts`
- Modify: `packages/core/src/geom.ts`（若需要点/距离 helper）

**Step 1: Minimal implementation**

- 在生成 tracks 后，选定轨迹源（优先 endNodes，否则 startNodes）。
- 为每条 track 计算 `startCenter/endCenter`，调用 `resolveOrbitBinding`。
- 在 `renderTrack` 内：
  - 先拿当前形变 `d`
  - 若有 orbit binding：
    - 计算轨迹插值 `t`（按 direction + shortest 调整）
    - 取轨迹点 `P(t)`
    - 计算当前中心 `C`（bbox center）
    - 平移 `d` 到 `P(t)`（用 `svgpath(d).translate(dx,dy)`）

**Step 2: Run test to verify it passes**
```bash
npm -w @svg-smart-animate/core test -- runtime.test.ts
```
Expected: PASS.

---

### Task 5: Demo UI 增加轨迹选项

**Files:**
- Modify: `apps/demo/src/main.ts`

**Step 1: Minimal implementation**

新增控件：
- 轨迹移动开关（off/auto/auto+manual）
- 容差输入（px）
- 方向选择（shortest/cw/ccw）

将选项传入 `animateSvg`：
```ts
orbitMode, orbitTolerance, orbitDirection
```

**Step 2: Manual check**

运行 demo，粘贴带 circle + data-orbit 的示例，确认运动沿圆弧。

---

### Task 6: 全量测试与提交

**Files:**
- None

**Step 1: Run full test suite**
```bash
npm test
```
Expected: PASS.

**Step 2: Commit**
```bash
git add packages/core/src/orbit.ts packages/core/src/runtime.ts packages/core/src/types.ts packages/core/src/runtime.test.ts apps/demo/src/main.ts
git commit -m "feat: orbit path motion"
```

---

Plan complete and saved to `docs/plans/2026-02-04-orbit-motion.md`.

Two execution options:

1. Subagent-Driven (this session) – I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) – Open new session with executing-plans, batch execution with checkpoints

Which approach?
