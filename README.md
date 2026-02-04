# svg-smart-animate

在网页中实现类似 Figma Smart Animate 的 SVG 形变动画：支持 Start/End 过渡、单 SVG 出现动画、属性节奏与曲线编辑。

## 快速开始

```bash
npm install
npm run dev
```

## 功能特性

- Start/End SVG 形变 + 单 SVG 出现动画
- 自动匹配：id/data-name 优先，几何+颜色 Hungarian 兜底
- 插值引擎：`auto`（命令一致用 d3，否则 flubber）、`flubber`、`d3`
- 属性节奏分离（形状/颜色/透明度/描边）
- **每个属性独立 cubic-bezier 曲线**（标准 x→y 时间映射）
- GSAP 或 RAF 时间轴驱动
- 轨道运动（自动或 `data-orbit` 绑定）
- 匹配可视化面板（调试）

## 如何引入（其他项目）

直接安装 npm 包：

```bash
npm install @marcodai/svg-smart-animate-core
```

代码中引入：

```ts
import { animateSvg } from '@marcodai/svg-smart-animate-core';
```

## 发布/安装步骤（npm）

安装：

```bash
npm install @marcodai/svg-smart-animate-core
```

版本发布（维护者）：

```bash
# core 构建
npm -w @marcodai/svg-smart-animate-core run build

# 发布（需要 npm 账号权限）
npm -w @marcodai/svg-smart-animate-core publish --access public
```

## 基本用法

```ts
import { animateSvg, easeInOutCubic } from '@marcodai/svg-smart-animate-core';

const controller = animateSvg({
  container: document.getElementById('preview')!,
  startSvg, // 可选
  endSvg,   // 必填
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

## 参数说明

### animateSvg(args)

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startSvg | string | 否 | 起始 SVG（空则走单 SVG 出现动画） |
| endSvg | string | 是 | 结束 SVG |
| container | HTMLElement | 是 | 渲染容器 |
| options | AnimateSvgOptions | 否 | 动画配置 |

### options（常用）

| 选项 | 说明 | 默认值 |
|------|------|--------|
| duration | 总时长（ms） | 600 |
| easing | 全局缓动（仅 RAF） | linear |
| morphEngine | `auto` \| `flubber` \| `d3` | auto |
| timeline | `raf` \| `gsap` | raf |
| gsapEasePreset | `fast-out-slow-in` \| `slow-in-fast-out` \| `symmetric` | fast-out-slow-in |
| appearStyle | `collapse-to-centroid` \| `bbox-to-shape` | collapse-to-centroid |
| propertyTiming | `balanced` \| `shape-first` \| `color-lag` | balanced |
| propertyCurves | 属性曲线覆盖（见下） | — |
| layerStagger | 分层延迟（ms） | 70 |
| intraStagger | 层内错峰（ms） | 18 |
| groupStrategy | `auto` \| `pathKey` \| `class` | auto |
| groupStagger | 分组延迟（ms） | 0 |
| orbitMode | `off` \| `auto` \| `auto+manual` | auto+manual |
| orbitTolerance | 轨道吸附容差（px） | 6 |

### propertyCurves（cubic-bezier）

`propertyCurves` 会覆盖 `propertyTiming` 对应属性的节奏：

```ts
const controller = animateSvg({
  container,
  startSvg,
  endSvg,
  options: {
    propertyTiming: 'shape-first',
    propertyCurves: {
      shape:  { x1: 0.2, y1: 0, x2: 0.8, y2: 1 },
      color:  { x1: 0,   y1: 0, x2: 1,   y2: 1 },
      opacity:{ x1: 0.1, y1: 0, x2: 0.9, y2: 1 },
      stroke: { x1: 0.3, y1: 0, x2: 0.7, y2: 1 }
    }
  }
});
```

> 曲线为 **标准 cubic-bezier（x 为时间，y 为进度）**。

## 返回值（controller）

| 方法 | 说明 |
|------|------|
| play() | 播放 |
| pause() | 暂停 |
| seek(t) | 跳转进度（0~1） |
| destroy() | 销毁并清空容器 |

## Demo 说明

- Start SVG 可为空：触发单 SVG 出现动画  
- 建议给元素加 `id` 或 `data-name` 提升匹配稳定性  
- 勾选“自定义曲线”可编辑形状/颜色/透明度/描边曲线  
- 运行 Demo：
  ```bash
  npm install
  npm run dev
  ```

## Notes / 当前限制

- 解析聚焦常见图元（`path/rect/circle/ellipse/line/polyline/polygon`）
- 组级别 transform/style 尚未完全展开（尽量把 transform 放在元素上）
- 复杂遮罩/滤镜在极端情况下仍可能出现偏差
