# Language Toggle (EN/ZH) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an English/Chinese language switcher (default English) to the demo UI, positioned on the top‑right of the header, and make labels/tooltips switch accordingly.

**Architecture:** Introduce a small in-memory i18n dictionary and a `setLanguage()` function that updates existing DOM text without recreating inputs. Store language in `localStorage` and fall back to English on first load.

**Tech Stack:** TypeScript, DOM API, Vite.

---

### Task 1: Add i18n dictionary + language state

**Files:**
- Modify: `apps/demo/src/main.ts`

**Step 1: Define dictionary + keys**

Add near the top:

```ts
type Lang = 'en' | 'zh';
const I18N: Record<Lang, Record<string, string>> = {
  en: {
    brandTitle: 'svg-smart-animate',
    brandDesc: 'Paste SVG (start/end), preview Smart Animate morph.',
    inputTitle: 'Input',
    previewTitle: 'Preview',
    run: 'Run',
    play: 'Play',
    pause: 'Pause',
    reset: 'Reset',
    timeline: 'Timeline',
    duration: 'Duration (ms)',
    easing: 'Easing',
    samplePoints: 'Sampling',
    appear: 'Single SVG appear',
    engine: 'Morph engine',
    engineTip: 'flubber: tolerant when path commands differ; d3: stable when commands match; auto: d3 if compatible, else flubber.',
    timelineDriver: 'Timeline',
    gsapEase: 'GSAP easing',
    motionProfile: 'Motion profile',
    motionTip: 'Adjust rhythm by element importance: focus-first for large elements, detail-first for fine details.',
    propertyTiming: 'Property timing',
    propertyTip: 'Decouple shape/color/opacity timing for Smart Animate feel.',
    curveToggle: 'Custom curves',
    curveTip: 'Enable independent cubic-bezier for shape/color/opacity/stroke.',
    matchPanel: 'Match panel',
    matchTip: 'Show match pairs and costs for debugging.',
    layerStagger: 'Layer stagger (ms)',
    groupStagger: 'Group stagger (ms)',
    groupStrategy: 'Grouping',
    intraStagger: 'In-layer stagger (ms)',
    orbitMode: 'Orbit',
    orbitTip: 'Move elements along closed paths (circle/ellipse). auto matches nearest orbit; auto+manual supports data-orbit="#id".',
    orbitDir: 'Direction',
    orbitTol: 'Tolerance (px)',
    orbitSnap: 'Orbit snap',
    orbitSnapTip: 'Allow snapping to nearest orbit when auto match fails.',
    orbitDebug: 'Orbit debug',
    orbitDebugTip: 'Highlight matched orbits in preview (debug only).',
    curvePanel: 'Property curves',
    startLabel: 'Start SVG (optional: single SVG appear)',
    endLabel: 'End SVG',
    empty: '(empty)',
    subdivisionTip: 'Sampling: smaller value = smoother but heavier; larger = faster but rougher.',
    langLabel: 'Language'
  },
  zh: {
    brandTitle: 'svg-smart-animate',
    brandDesc: '粘贴 SVG（start / end），一键预览 Smart Animate 形变。',
    inputTitle: '输入',
    previewTitle: '预览',
    run: '运行',
    play: '播放',
    pause: '暂停',
    reset: '重置',
    timeline: '时间轴',
    duration: '时长(ms)',
    easing: '缓动',
    samplePoints: '细分',
    appear: '单 SVG 出现',
    engine: '插值引擎',
    engineTip: 'flubber：通用性强，可处理命令不一致的路径；d3：命令一致时更稳定；auto：命令一致用 d3，否则用 flubber。',
    timelineDriver: '时间轴',
    gsapEase: 'GSAP节奏',
    motionProfile: '节奏配置',
    motionTip: '按元素重要性调整节奏：focus-first 让大元素更快进入，detail-first 让细节更快显现。',
    propertyTiming: '属性节奏',
    propertyTip: '分离形状/颜色/透明度节奏，让形变更快、颜色略慢，整体更像 Smart Animate。',
    curveToggle: '自定义曲线',
    curveTip: '启用后可为形状/颜色/透明度/描边设置独立 cubic-bezier 曲线。',
    matchPanel: '匹配面板',
    matchTip: '展示 start/end 形状匹配关系与成本，便于排查错配。',
    layerStagger: '分层延迟(ms)',
    groupStagger: '分组延迟(ms)',
    groupStrategy: '分组规则',
    intraStagger: '层内错峰(ms)',
    orbitMode: '轨道',
    orbitTip: '轨道运动：让元素沿闭合描边路径（如圆/椭圆）移动。auto 会自动匹配最近轨道；auto+manual 支持 data-orbit="#id" 显式绑定。',
    orbitDir: '方向',
    orbitTol: '容差(px)',
    orbitSnap: '轨道吸附',
    orbitSnapTip: '自动匹配不到时，允许在更宽容差内吸附到最近轨道。',
    orbitDebug: '轨道调试',
    orbitDebugTip: '在预览中高亮匹配到的轨道（开发排查用，线上建议关闭）。',
    curvePanel: '属性曲线',
    startLabel: 'Start SVG（可留空：将触发单 SVG 出现）',
    endLabel: 'End SVG',
    empty: '（空）',
    subdivisionTip: '细分参数：控制路径切分密度。数值越大分段越少更省性能，数值越小更平滑但更耗性能。',
    langLabel: '语言'
  }
};

let currentLang: Lang = (localStorage.getItem('ssa_lang') as Lang) || 'en';
const t = (key: string) => I18N[currentLang][key] || key;
```

**Step 2: Create language switcher in header**

- Add a small `<select>` in the header right (after button row) with EN / 中文.
- On change: update `currentLang`, write to localStorage, call `applyLanguage()`.

---

### Task 2: Wire labels/tooltips to i18n

**Files:**
- Modify: `apps/demo/src/main.ts`

**Step 1: Make UI text updateable**

- Store references to key DOM nodes (brand title/desc, buttons, labels, tooltips, panel titles).
- Replace hardcoded strings with `t(key)` during creation.

**Step 2: Implement applyLanguage()**

```ts
function applyLanguage() {
  brand.innerHTML = `<h1>${t('brandTitle')}</h1><p>${t('brandDesc')}</p>`;
  leftHeader.querySelector('strong')!.textContent = t('inputTitle');
  rightHeader.querySelector('strong')!.textContent = t('previewTitle');
  runBtn.textContent = t('run');
  playBtn.textContent = t('play');
  pauseBtn.textContent = t('pause');
  resetBtn.textContent = t('reset');
  timelineLabel.childNodes[0].textContent = `${t('timeline')} `;
  // update control labels + tooltips
  durationWrap.childNodes[0].textContent = `${t('duration')} `;
  easingWrap.childNodes[0].textContent = `${t('easing')} `;
  pointsWrap.childNodes[0].textContent = `${t('samplePoints')} `;
  appearWrap.childNodes[0].textContent = `${t('appear')} `;
  engineWrap.childNodes[0].textContent = `${t('engine')} `;
  engineHelpTip.textContent = t('engineTip');
  timelineWrap.childNodes[0].textContent = `${t('timelineDriver')} `;
  gsapEaseWrap.childNodes[0].textContent = `${t('gsapEase')} `;
  motionWrap.childNodes[0].textContent = `${t('motionProfile')} `;
  motionHelpTip.textContent = t('motionTip');
  propTimingWrap.childNodes[0].textContent = `${t('propertyTiming')} `;
  propTimingHelpTip.textContent = t('propertyTip');
  curveToggleWrap.childNodes[0].textContent = `${t('curveToggle')} `;
  curveHelpTip.textContent = t('curveTip');
  matchDebugWrap.childNodes[0].textContent = `${t('matchPanel')} `;
  matchDebugHelpTip.textContent = t('matchTip');
  layerWrap.childNodes[0].textContent = `${t('layerStagger')} `;
  groupWrap.childNodes[0].textContent = `${t('groupStagger')} `;
  groupStrategyWrap.childNodes[0].textContent = `${t('groupStrategy')} `;
  intraWrap.childNodes[0].textContent = `${t('intraStagger')} `;
  orbitModeWrap.childNodes[0].textContent = `${t('orbitMode')} `;
  orbitHelpTip.textContent = t('orbitTip');
  orbitDirWrap.childNodes[0].textContent = `${t('orbitDir')} `;
  orbitTolWrap.childNodes[0].textContent = `${t('orbitTol')} `;
  orbitSnapWrap.childNodes[0].textContent = `${t('orbitSnap')} `;
  orbitSnapHelpTip.textContent = t('orbitSnapTip');
  orbitDebugWrap.childNodes[0].textContent = `${t('orbitDebug')} `;
  orbitDebugHelpTip.textContent = t('orbitDebugTip');
  curveTitle.textContent = t('curvePanel');
  startPanel.firstElementChild!.textContent = t('startLabel');
  endPanel.firstElementChild!.textContent = t('endLabel');
  helpTip.textContent = t('subdivisionTip');
  langLabel.textContent = `${t('langLabel')} `;
}
```

**Step 3: Call applyLanguage() on init**

After building the DOM, call `applyLanguage()`.

---

### Task 3: Manual verification

**Step 1: Run demo**

```bash
npm -w @svg-smart-animate/demo run dev
```

Check:
- Default language is English.
- Switcher toggles to Chinese and updates labels/tooltips.
- Inputs and preview still render.

---

### Task 4: Commit

```bash
git add apps/demo/src/main.ts

git commit -m "feat(demo): add EN/ZH language toggle"
```
