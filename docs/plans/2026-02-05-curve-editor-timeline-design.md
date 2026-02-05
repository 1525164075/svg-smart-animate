# 2026-02-05 曲线编辑器替换 + 时间轴控制 设计

## 目标
- 用开源 Curve Editor（Tweakpane 插件）替换 demo 中的自定义曲线编辑器。
- 增加时间轴控制：可拖拽定位 + 显示当前时间；播放时自动跟随。
- 保持现有 Smart Animate 逻辑与 UI 布局，不重构核心动画流程。

## 需求要点
- 曲线编辑器使用 Tweakpane 的 cubic-bezier 插件，支持形状/颜色/透明度/描边 4 条独立曲线。
- 曲线值写入现有 `propertyCurves`（BezierCurve），并与“自定义曲线”开关联动。
- 时间轴：0..1 进度滑杆 + 毫秒显示；拖拽时 `pause + seek`，松开后允许继续播放。
- 播放时自动跟随进度（需要 core 提供 onProgress 回调）。

## 方案概述
### 曲线编辑器
- 在 `apps/demo/src/main.ts` 中创建 Tweakpane 实例，注册 `@tweakpane/plugin-cubic-bezier`。
- 为每条曲线创建 folder，绑定到 `curveState`；通过 onChange 更新 `curveState`。
- “自定义曲线”仅控制面板显示，不销毁 pane（保留用户编辑状态）。

### 时间轴
- Core：在 `AnimateSvgOptions` 新增 `onProgress?: (t:number)=>void`。
- Runtime：在 RAF/GSAP 渲染后触发 onProgress。
- Demo：新增滑杆与时间显示；
  - 拖拽时暂停并 seek；
  - 播放时跟随回写进度（避免 scrubbing 时反复回写）。

## 影响范围
- `packages/core/src/types.ts`：扩展 AnimateSvgOptions。
- `packages/core/src/runtime.ts`：调用 onProgress。
- `apps/demo/src/main.ts`：替换曲线编辑器 + 时间轴 UI/逻辑。
- `apps/demo/src/styles.css`：补充 Tweakpane 样式 + 时间轴样式。
- `apps/demo/package.json`：新增依赖 `@tweakpane/plugin-cubic-bezier`（如尚未添加）。

## 风险与规避
- 进度回写导致拖拽抖动：使用 `isScrubbing` 保护。
- 曲线同步不一致：以 `curveState` 为单一数据源。
- 样式冲突：限定 Tweakpane 样式作用域到曲线面板容器。

## 验收标准
- 曲线编辑器可编辑，动画使用新曲线。
- 时间轴拖拽可定位，播放时自动跟随且显示时间准确。
- 现有播放/暂停/重置功能不受影响。
