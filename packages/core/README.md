# @marcodai/svg-smart-animate-core

SVG Smart Animate 核心库（Start/End 形变 + 单 SVG 出现动画）。

## 安装

```bash
npm install @marcodai/svg-smart-animate-core
```

## 使用

```ts
import { animateSvg } from '@marcodai/svg-smart-animate-core';

const controller = animateSvg({
  container: document.getElementById('preview')!,
  startSvg, // 可选
  endSvg,
  options: { duration: 700 }
});

controller.play();
```

## 文档

详见仓库根目录 README。
