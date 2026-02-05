import './styles.css';
import { animateSvg, easeInOutCubic, linear, type AnimateController, type MatchDebugInfo, type BezierCurve } from '@marcodai/svg-smart-animate-core';
import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

const sampleStart = `<svg viewBox="0 0 100 100">
  <rect id="shape" x="12" y="18" width="32" height="24" rx="6" fill="#7CFCFF"/>
  <circle id="dot" cx="70" cy="70" r="8" fill="#FFD166"/>
</svg>`;

const sampleEnd = `<svg viewBox="0 0 100 100">
  <circle id="shape" cx="70" cy="40" r="18" fill="#7CFCFF"/>
  <rect id="dot" x="18" y="62" width="34" height="18" rx="9" fill="#FFD166"/>
</svg>`;

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
    gsapFastOutSlowIn: 'Fast in, slow out',
    gsapSlowInFastOut: 'Slow in, fast out',
    gsapSymmetric: 'Symmetric',
    motionProfile: 'Motion profile',
    motionUniform: 'Uniform',
    motionFocusFirst: 'Focus first',
    motionDetailFirst: 'Detail first',
    motionTip: 'Adjust rhythm by element importance: focus-first for large elements, detail-first for fine details.',
    propertyTiming: 'Property timing',
    propBalanced: 'Balanced',
    propShapeFirst: 'Shape first',
    propColorLag: 'Color lag',
    propertyTip: 'Decouple shape/color/opacity timing for Smart Animate feel.',
    curveToggle: 'Custom curves',
    curveTip: 'Enable independent cubic-bezier for shape/color/opacity/stroke.',
    matchPanel: 'Match panel',
    matchPanelTitle: 'Match Visualizer',
    matchTip: 'Show match pairs and costs for debugging.',
    matchPairs: 'pairs',
    matchUnmatched: 'unmatched',
    matchStartUnmatched: 'Start unmatched',
    matchEndUnmatched: 'End unmatched',
    layerStagger: 'Layer stagger (ms)',
    groupStagger: 'Group stagger (ms)',
    groupStrategy: 'Grouping',
    intraStagger: 'In-layer stagger (ms)',
    orbitMode: 'Orbit',
    orbitTip: 'Move elements along closed paths (circle/ellipse). auto matches nearest orbit; auto+manual supports data-orbit=\"#id\".',
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
    langLabel: 'Language',
    matchEmpty: '(no matches)'
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
    gsapFastOutSlowIn: '快速进入，慢慢收尾',
    gsapSlowInFastOut: '缓慢进入，快速收尾',
    gsapSymmetric: '中性对称',
    motionProfile: '节奏配置',
    motionUniform: 'uniform',
    motionFocusFirst: 'focus-first',
    motionDetailFirst: 'detail-first',
    motionTip: '按元素重要性调整节奏：focus-first 让大元素更快进入，detail-first 让细节更快显现。',
    propertyTiming: '属性节奏',
    propBalanced: 'balanced',
    propShapeFirst: 'shape-first',
    propColorLag: 'color-lag',
    propertyTip: '分离形状/颜色/透明度节奏，让形变更快、颜色略慢，整体更像 Smart Animate。',
    curveToggle: '自定义曲线',
    curveTip: '启用后可为形状/颜色/透明度/描边设置独立 cubic-bezier 曲线。',
    matchPanel: '匹配面板',
    matchPanelTitle: '匹配可视化',
    matchTip: '展示 start/end 形状匹配关系与成本，便于排查错配。',
    matchPairs: '对',
    matchUnmatched: '未匹配',
    matchStartUnmatched: 'Start 未匹配',
    matchEndUnmatched: 'End 未匹配',
    layerStagger: '分层延迟(ms)',
    groupStagger: '分组延迟(ms)',
    groupStrategy: '分组规则',
    intraStagger: '层内错峰(ms)',
    orbitMode: '轨道',
    orbitTip: '轨道运动：让元素沿闭合描边路径（如圆/椭圆）移动。auto 会自动匹配最近轨道；auto+manual 支持 data-orbit=\"#id\" 显式绑定。',
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
    langLabel: '语言',
    matchEmpty: '（无匹配对）'
  }
};

let currentLang: Lang = (localStorage.getItem('ssa_lang') as Lang) || 'en';
const t = (key: string) => I18N[currentLang][key] || key;

type EasingChoice = 'linear' | 'easeInOutCubic';

function parseEasing(choice: EasingChoice) {
  return choice === 'easeInOutCubic' ? easeInOutCubic : linear;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

const app = document.querySelector<HTMLDivElement>('#app')!;

const container = el('div', 'container');
app.appendChild(container);

const header = el('div', 'header');
container.appendChild(header);

const brand = el('div', 'brand');
const brandTitle = document.createElement('h1');
const brandDesc = document.createElement('p');
brand.appendChild(brandTitle);
brand.appendChild(brandDesc);
header.appendChild(brand);

const headerActions = el('div', 'headerActions');
header.appendChild(headerActions);

const buttonRow = el('div', 'buttonRow');
headerActions.appendChild(buttonRow);

const runBtn = el('button', 'primary');
runBtn.textContent = '运行';
buttonRow.appendChild(runBtn);

const playBtn = el('button');
playBtn.textContent = '播放';
buttonRow.appendChild(playBtn);

const pauseBtn = el('button');
pauseBtn.textContent = '暂停';
buttonRow.appendChild(pauseBtn);

const resetBtn = el('button');
resetBtn.textContent = '重置';
buttonRow.appendChild(resetBtn);

const langWrap = el('label', 'control langControl');
const langLabel = document.createElement('span');
langWrap.appendChild(langLabel);
const langSelect = document.createElement('select');
const langOptEn = document.createElement('option');
langOptEn.value = 'en';
langOptEn.textContent = 'EN';
const langOptZh = document.createElement('option');
langOptZh.value = 'zh';
langOptZh.textContent = '中文';
langSelect.appendChild(langOptEn);
langSelect.appendChild(langOptZh);
langWrap.appendChild(langSelect);
headerActions.appendChild(langWrap);

langSelect.value = currentLang;
langSelect.addEventListener('change', () => {
  currentLang = (langSelect.value as Lang) || 'en';
  localStorage.setItem('ssa_lang', currentLang);
  applyLanguage();
});

const left = el('div', 'card');
container.appendChild(left);

const leftHeader = el('div', 'cardHeader');
left.appendChild(leftHeader);
const leftTitle = document.createElement('strong');
leftHeader.appendChild(leftTitle);

const controls = el('div', 'controls');
leftHeader.appendChild(controls);

const helpWrap = el('span', 'tooltipWrap');
const helpBtn = el('button', 'helpTip');
helpBtn.type = 'button';
helpBtn.textContent = '?';
const helpTip = el('div', 'tooltip');
helpTip.textContent = '细分参数：控制路径切分密度。数值越大分段越少更省性能，数值越小更平滑但更耗性能。';
helpWrap.appendChild(helpBtn);
helpWrap.appendChild(helpTip);
leftHeader.appendChild(helpWrap);

const durationWrap = el('label', 'control');
durationWrap.innerHTML = `时长(ms) <input type="number" min="50" step="50" value="700" />`;
controls.appendChild(durationWrap);
const durationInput = durationWrap.querySelector<HTMLInputElement>('input')!;

const easingWrap = el('label', 'control');
easingWrap.innerHTML = `缓动 <select><option value="easeInOutCubic">easeInOutCubic</option><option value="linear">linear</option></select>`;
controls.appendChild(easingWrap);
const easingSelect = easingWrap.querySelector<HTMLSelectElement>('select')!;

const pointsWrap = el('label', 'control');
pointsWrap.innerHTML = `细分 <input type="number" min="16" step="16" value="128" />`;
controls.appendChild(pointsWrap);
const pointsInput = pointsWrap.querySelector<HTMLInputElement>('input')!;

const appearWrap = el('label', 'control');
appearWrap.innerHTML = `单 SVG 出现 <select><option value="collapse-to-centroid">collapse-to-centroid</option><option value="bbox-to-shape">bbox-to-shape</option></select>`;
controls.appendChild(appearWrap);
const appearSelect = appearWrap.querySelector<HTMLSelectElement>('select')!;

const engineWrap = el('label', 'control');
engineWrap.innerHTML = `插值引擎 <select><option value="auto">auto</option><option value="flubber">flubber</option><option value="d3">d3</option></select>`;
const engineHelpWrap = el('span', 'tooltipWrap');
const engineHelpBtn = el('button', 'helpTipSmall');
engineHelpBtn.type = 'button';
engineHelpBtn.textContent = '?';
const engineHelpTip = el('div', 'tooltip');
engineHelpTip.textContent =
  'flubber：通用性强，可处理命令不一致的路径；d3：命令一致时更稳定；auto：命令一致用 d3，否则用 flubber。';
engineHelpWrap.appendChild(engineHelpBtn);
engineHelpWrap.appendChild(engineHelpTip);
engineWrap.appendChild(engineHelpWrap);
controls.appendChild(engineWrap);
const engineSelect = engineWrap.querySelector<HTMLSelectElement>('select')!;

const timelineWrap = el('label', 'control');
timelineWrap.innerHTML = `时间轴 <select><option value="raf">raf</option><option value="gsap">gsap</option></select>`;
controls.appendChild(timelineWrap);
const timelineSelect = timelineWrap.querySelector<HTMLSelectElement>('select')!;

const gsapEaseWrap = el('label', 'control');
gsapEaseWrap.innerHTML =
  `GSAP节奏 <select>` +
  `<option value="fast-out-slow-in">快速进入，慢慢收尾</option>` +
  `<option value="slow-in-fast-out">缓慢进入，快速收尾</option>` +
  `<option value="symmetric">中性对称</option>` +
  `</select>`;
controls.appendChild(gsapEaseWrap);
const gsapEaseSelect = gsapEaseWrap.querySelector<HTMLSelectElement>('select')!;

const motionWrap = el('label', 'control');
motionWrap.innerHTML =
  `节奏配置 <select>` +
  `<option value="uniform">uniform</option>` +
  `<option value="focus-first">focus-first</option>` +
  `<option value="detail-first">detail-first</option>` +
  `</select>`;
const motionHelpWrap = el('span', 'tooltipWrap');
const motionHelpBtn = el('button', 'helpTipSmall');
motionHelpBtn.type = 'button';
motionHelpBtn.textContent = '?';
const motionHelpTip = el('div', 'tooltip');
motionHelpTip.textContent = '按元素重要性调整节奏：focus-first 让大元素更快进入，detail-first 让细节更快显现。';
motionHelpWrap.appendChild(motionHelpBtn);
motionHelpWrap.appendChild(motionHelpTip);
motionWrap.appendChild(motionHelpWrap);
controls.appendChild(motionWrap);
const motionSelect = motionWrap.querySelector<HTMLSelectElement>('select')!;

const propTimingWrap = el('label', 'control');
propTimingWrap.innerHTML =
  `属性节奏 <select>` +
  `<option value="balanced">balanced</option>` +
  `<option value="shape-first">shape-first</option>` +
  `<option value="color-lag">color-lag</option>` +
  `</select>`;
const propTimingHelpWrap = el('span', 'tooltipWrap');
const propTimingHelpBtn = el('button', 'helpTipSmall');
propTimingHelpBtn.type = 'button';
propTimingHelpBtn.textContent = '?';
const propTimingHelpTip = el('div', 'tooltip');
propTimingHelpTip.textContent = '分离形状/颜色/透明度节奏，让形变更快、颜色略慢，整体更像 Smart Animate。';
propTimingHelpWrap.appendChild(propTimingHelpBtn);
propTimingHelpWrap.appendChild(propTimingHelpTip);
propTimingWrap.appendChild(propTimingHelpWrap);
controls.appendChild(propTimingWrap);
const propTimingSelect = propTimingWrap.querySelector<HTMLSelectElement>('select')!;

const curveToggleWrap = el('label', 'control');
curveToggleWrap.innerHTML = `自定义曲线 <input type="checkbox" />`;
const curveHelpWrap = el('span', 'tooltipWrap');
const curveHelpBtn = el('button', 'helpTipSmall');
curveHelpBtn.type = 'button';
curveHelpBtn.textContent = '?';
const curveHelpTip = el('div', 'tooltip');
curveHelpTip.textContent = '启用后可为形状/颜色/透明度/描边设置独立 cubic-bezier 曲线，优先于属性节奏设置。';
curveHelpWrap.appendChild(curveHelpBtn);
curveHelpWrap.appendChild(curveHelpTip);
curveToggleWrap.appendChild(curveHelpWrap);
controls.appendChild(curveToggleWrap);
const curveToggleInput = curveToggleWrap.querySelector<HTMLInputElement>('input')!;

const matchDebugWrap = el('label', 'control');
matchDebugWrap.innerHTML = `匹配面板 <input type="checkbox" checked />`;
const matchDebugHelpWrap = el('span', 'tooltipWrap');
const matchDebugHelpBtn = el('button', 'helpTipSmall');
matchDebugHelpBtn.type = 'button';
matchDebugHelpBtn.textContent = '?';
const matchDebugHelpTip = el('div', 'tooltip');
matchDebugHelpTip.textContent = '展示 start/end 形状匹配关系与成本，便于排查错配。';
matchDebugHelpWrap.appendChild(matchDebugHelpBtn);
matchDebugHelpWrap.appendChild(matchDebugHelpTip);
matchDebugWrap.appendChild(matchDebugHelpWrap);
controls.appendChild(matchDebugWrap);
const matchDebugInput = matchDebugWrap.querySelector<HTMLInputElement>('input')!;

const layerWrap = el('label', 'control');
layerWrap.innerHTML = `分层延迟(ms) <input type="number" min="0" step="10" value="70" />`;
controls.appendChild(layerWrap);
const layerInput = layerWrap.querySelector<HTMLInputElement>('input')!;

const groupWrap = el('label', 'control');
groupWrap.innerHTML = `分组延迟(ms) <input type="number" min="0" step="10" value="0" />`;
controls.appendChild(groupWrap);
const groupInput = groupWrap.querySelector<HTMLInputElement>('input')!;

const groupStrategyWrap = el('label', 'control');
groupStrategyWrap.innerHTML =
  `分组规则 <select>` +
  `<option value="auto">auto</option>` +
  `<option value="pathKey">pathKey</option>` +
  `<option value="class">class</option>` +
  `</select>`;
controls.appendChild(groupStrategyWrap);
const groupStrategySelect = groupStrategyWrap.querySelector<HTMLSelectElement>('select')!;

const intraWrap = el('label', 'control');
intraWrap.innerHTML = `层内错峰(ms) <input type="number" min="0" step="2" value="18" />`;
controls.appendChild(intraWrap);
const intraInput = intraWrap.querySelector<HTMLInputElement>('input')!;

const orbitModeWrap = el('label', 'control');
orbitModeWrap.innerHTML =
  `轨道 <select>` +
  `<option value="auto+manual">auto+manual</option>` +
  `<option value="auto">auto</option>` +
  `<option value="off">off</option>` +
  `</select>`;
const orbitHelpWrap = el('span', 'tooltipWrap');
const orbitHelpBtn = el('button', 'helpTipSmall');
orbitHelpBtn.type = 'button';
orbitHelpBtn.textContent = '?';
const orbitHelpTip = el('div', 'tooltip');
orbitHelpTip.textContent =
  '轨道运动：让元素沿闭合描边路径（如圆/椭圆）移动。auto 会自动匹配最近轨道；auto+manual 支持 data-orbit="#id" 显式绑定。';
orbitHelpWrap.appendChild(orbitHelpBtn);
orbitHelpWrap.appendChild(orbitHelpTip);
orbitModeWrap.appendChild(orbitHelpWrap);
controls.appendChild(orbitModeWrap);
const orbitModeSelect = orbitModeWrap.querySelector<HTMLSelectElement>('select')!;

const orbitDirWrap = el('label', 'control');
orbitDirWrap.innerHTML =
  `方向 <select>` +
  `<option value="shortest">shortest</option>` +
  `<option value="cw">cw</option>` +
  `<option value="ccw">ccw</option>` +
  `</select>`;
controls.appendChild(orbitDirWrap);
const orbitDirSelect = orbitDirWrap.querySelector<HTMLSelectElement>('select')!;

const orbitTolWrap = el('label', 'control');
orbitTolWrap.innerHTML = `容差(px) <input type="number" min="0" step="1" value="6" />`;
controls.appendChild(orbitTolWrap);
const orbitTolInput = orbitTolWrap.querySelector<HTMLInputElement>('input')!;

const orbitSnapWrap = el('label', 'control');
orbitSnapWrap.innerHTML = `轨道吸附 <input type="checkbox" checked />`;
const orbitSnapHelpWrap = el('span', 'tooltipWrap');
const orbitSnapHelpBtn = el('button', 'helpTipSmall');
orbitSnapHelpBtn.type = 'button';
orbitSnapHelpBtn.textContent = '?';
const orbitSnapHelpTip = el('div', 'tooltip');
orbitSnapHelpTip.textContent = '自动匹配不到时，允许在更宽容差内吸附到最近轨道。';
orbitSnapHelpWrap.appendChild(orbitSnapHelpBtn);
orbitSnapHelpWrap.appendChild(orbitSnapHelpTip);
orbitSnapWrap.appendChild(orbitSnapHelpWrap);
controls.appendChild(orbitSnapWrap);
const orbitSnapInput = orbitSnapWrap.querySelector<HTMLInputElement>('input')!;

const orbitDebugWrap = el('label', 'control');
orbitDebugWrap.innerHTML = `轨道调试 <input type="checkbox" />`;
const orbitDebugHelpWrap = el('span', 'tooltipWrap');
const orbitDebugHelpBtn = el('button', 'helpTipSmall');
orbitDebugHelpBtn.type = 'button';
orbitDebugHelpBtn.textContent = '?';
const orbitDebugHelpTip = el('div', 'tooltip');
orbitDebugHelpTip.textContent = '在预览中高亮匹配到的轨道（开发排查用，线上建议关闭）。';
orbitDebugHelpWrap.appendChild(orbitDebugHelpBtn);
orbitDebugHelpWrap.appendChild(orbitDebugHelpTip);
orbitDebugWrap.appendChild(orbitDebugHelpWrap);
controls.appendChild(orbitDebugWrap);
const orbitDebugInput = orbitDebugWrap.querySelector<HTMLInputElement>('input')!;

const curvePanel = el('div', 'curvePanel');
left.appendChild(curvePanel);
const curveTitle = el('div', 'curvePanelTitle');
curveTitle.textContent = '属性曲线';
curvePanel.appendChild(curveTitle);
const curvePaneWrap = el('div', 'curvePaneWrap');
curvePanel.appendChild(curvePaneWrap);

type CurveTuple = [number, number, number, number];
const linearCurveTuple: CurveTuple = [0, 0, 1, 1];
const curveState = {
  shape: [...linearCurveTuple] as CurveTuple,
  color: [...linearCurveTuple] as CurveTuple,
  opacity: [...linearCurveTuple] as CurveTuple,
  stroke: [...linearCurveTuple] as CurveTuple
};

const curvePane = new Pane({ container: curvePaneWrap });
curvePane.registerPlugin(EssentialsPlugin);

const addCurveBlade = (title: string, key: keyof typeof curveState) => {
  const blade = curvePane.addBlade({
    view: 'cubicbezier',
    label: title,
    value: curveState[key]
  });
  blade.on('change', (ev) => {
    const v = (ev as { value?: { toObject?: () => CurveTuple } }).value;
    curveState[key] = v && typeof v.toObject === 'function' ? v.toObject() : (v as CurveTuple);
  });
};

addCurveBlade('形状', 'shape');
addCurveBlade('颜色', 'color');
addCurveBlade('透明度', 'opacity');
addCurveBlade('描边', 'stroke');

function syncCurvePanel() {
  curvePanel.style.display = curveToggleInput.checked ? 'block' : 'none';
}
curveToggleInput.addEventListener('change', syncCurvePanel);
syncCurvePanel();
const split = el('div', 'split');
left.appendChild(split);

const startPanel = el('div');
split.appendChild(startPanel);
const startLabel = el('div');
startLabel.style.padding = '10px 0 8px';
startLabel.style.color = 'var(--muted)';
startLabel.style.fontSize = '12px';
startPanel.appendChild(startLabel);
const startText = el('textarea');
startText.value = sampleStart;
startPanel.appendChild(startText);
const startPreview = el('div', 'miniPreview');
startPanel.appendChild(startPreview);

const endPanel = el('div');
split.appendChild(endPanel);
const endLabel = el('div');
endLabel.style.padding = '10px 0 8px';
endLabel.style.color = 'var(--muted)';
endLabel.style.fontSize = '12px';
endPanel.appendChild(endLabel);
const endText = el('textarea');
endText.value = sampleEnd;
endPanel.appendChild(endText);
const endPreview = el('div', 'miniPreview');
endPanel.appendChild(endPreview);

const right = el('div', 'card');
container.appendChild(right);

const rightHeader = el('div', 'cardHeader');
right.appendChild(rightHeader);
const rightTitle = document.createElement('strong');
rightHeader.appendChild(rightTitle);

const timelineBox = el('div', 'timelineBox');
const timelineLabel = el('div', 'timelineLabel');
timelineLabel.textContent = '时间轴 ';
const timelineValue = el('span', 'timelineValue');
timelineValue.textContent = '(0ms)';
timelineLabel.appendChild(timelineValue);
const timelineInput = document.createElement('input');
timelineInput.type = 'range';
timelineInput.min = '0';
timelineInput.max = '1000';
timelineInput.value = '0';
timelineInput.className = 'timelineSlider';
timelineBox.appendChild(timelineLabel);
timelineBox.appendChild(timelineInput);
rightHeader.appendChild(timelineBox);

const previewWrap = el('div', 'previewWrap');
right.appendChild(previewWrap);

const preview = el('div', 'preview');
previewWrap.appendChild(preview);

const errorBox = el('div', 'error');
errorBox.style.display = 'none';
right.appendChild(errorBox);

const matchPanel = el('div', 'matchPanel');
matchPanel.style.display = 'none';
right.appendChild(matchPanel);

let controller: AnimateController | null = null;
let lastMatchInfo: MatchDebugInfo | null = null;
let isScrubbing = false;

const updateTimelineUI = (p: number) => {
  const clamped = Math.max(0, Math.min(1, p));
  timelineInput.value = String(Math.round(clamped * 1000));
  const duration = Number.parseInt(durationInput.value || '700', 10);
  const ms = Math.round(clamped * duration);
  timelineValue.textContent = `(${ms}ms)`;
};

function setLabelText(label: HTMLElement, text: string) {
  const node = label.childNodes[0];
  const value = `${text} `;
  if (node && node.nodeType === Node.TEXT_NODE) {
    node.textContent = value;
  } else {
    label.insertBefore(document.createTextNode(value), label.firstChild);
  }
}

function setupTooltip(btn: HTMLButtonElement, tip: HTMLDivElement) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    tip.classList.toggle('show');
  });
}

document.addEventListener('click', () => {
  for (const el of document.querySelectorAll('.tooltip.show')) {
    el.classList.remove('show');
  }
});

setupTooltip(helpBtn, helpTip);
setupTooltip(engineHelpBtn, engineHelpTip);
setupTooltip(orbitHelpBtn, orbitHelpTip);
setupTooltip(orbitSnapHelpBtn, orbitSnapHelpTip);
setupTooltip(orbitDebugHelpBtn, orbitDebugHelpTip);
setupTooltip(motionHelpBtn, motionHelpTip);
setupTooltip(propTimingHelpBtn, propTimingHelpTip);
setupTooltip(curveHelpBtn, curveHelpTip);
setupTooltip(matchDebugHelpBtn, matchDebugHelpTip);

function applyLanguage() {
  brandTitle.textContent = t('brandTitle');
  brandDesc.textContent = t('brandDesc');
  leftTitle.textContent = t('inputTitle');
  rightTitle.textContent = t('previewTitle');
  runBtn.textContent = t('run');
  playBtn.textContent = t('play');
  pauseBtn.textContent = t('pause');
  resetBtn.textContent = t('reset');
  setLabelText(durationWrap, t('duration'));
  setLabelText(easingWrap, t('easing'));
  setLabelText(pointsWrap, t('samplePoints'));
  setLabelText(appearWrap, t('appear'));
  setLabelText(engineWrap, t('engine'));
  setLabelText(timelineWrap, t('timelineDriver'));
  setLabelText(gsapEaseWrap, t('gsapEase'));
  setLabelText(motionWrap, t('motionProfile'));
  setLabelText(propTimingWrap, t('propertyTiming'));
  setLabelText(curveToggleWrap, t('curveToggle'));
  setLabelText(matchDebugWrap, t('matchPanel'));
  setLabelText(layerWrap, t('layerStagger'));
  setLabelText(groupWrap, t('groupStagger'));
  setLabelText(groupStrategyWrap, t('groupStrategy'));
  setLabelText(intraWrap, t('intraStagger'));
  setLabelText(orbitModeWrap, t('orbitMode'));
  setLabelText(orbitDirWrap, t('orbitDir'));
  setLabelText(orbitTolWrap, t('orbitTol'));
  setLabelText(orbitSnapWrap, t('orbitSnap'));
  setLabelText(orbitDebugWrap, t('orbitDebug'));
  langLabel.textContent = `${t('langLabel')} `;

  timelineLabel.childNodes[0].textContent = `${t('timeline')} `;
  curveTitle.textContent = t('curvePanel');
  startLabel.textContent = t('startLabel');
  endLabel.textContent = t('endLabel');

  helpTip.textContent = t('subdivisionTip');
  engineHelpTip.textContent = t('engineTip');
  motionHelpTip.textContent = t('motionTip');
  propTimingHelpTip.textContent = t('propertyTip');
  curveHelpTip.textContent = t('curveTip');
  matchDebugHelpTip.textContent = t('matchTip');
  orbitHelpTip.textContent = t('orbitTip');
  orbitSnapHelpTip.textContent = t('orbitSnapTip');
  orbitDebugHelpTip.textContent = t('orbitDebugTip');

  gsapEaseSelect.options[0].textContent = t('gsapFastOutSlowIn');
  gsapEaseSelect.options[1].textContent = t('gsapSlowInFastOut');
  gsapEaseSelect.options[2].textContent = t('gsapSymmetric');

  motionSelect.options[0].textContent = t('motionUniform');
  motionSelect.options[1].textContent = t('motionFocusFirst');
  motionSelect.options[2].textContent = t('motionDetailFirst');

  propTimingSelect.options[0].textContent = t('propBalanced');
  propTimingSelect.options[1].textContent = t('propShapeFirst');
  propTimingSelect.options[2].textContent = t('propColorLag');

  renderRawSvg(startPreview, startText.value);
  renderRawSvg(endPreview, endText.value);
  renderMatchPanel(lastMatchInfo);
}

function renderRawSvg(target: HTMLDivElement, svgText: string) {
  target.innerHTML = '';
  const trimmed = svgText.trim();
  if (!trimmed) {
    target.innerHTML = `<div style="color: var(--muted); font-size: 12px;">${t('empty')}</div>`;
    return;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('不是有效的 SVG 根节点');

    // Basic sanitization for local demo.
    svg.querySelectorAll('script, foreignObject').forEach((n) => n.remove());

    const imported = document.importNode(svg, true) as SVGSVGElement;
    imported.setAttribute('width', '100%');
    imported.setAttribute('height', '100%');

    target.appendChild(imported);
  } catch (e) {
    target.innerHTML = `<div style="color: var(--danger); font-family: var(--mono); font-size: 12px; padding: 10px;">${e instanceof Error ? e.message : String(e)
      }</div>`;
  }
}

function setError(err: unknown) {
  if (!err) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
    return;
  }
  errorBox.style.display = 'block';
  errorBox.textContent = err instanceof Error ? err.stack || err.message : String(err);
}

function labelForNode(node: MatchDebugInfo['pairs'][number]['start']): string {
  const id = node.id || '';
  const path = node.pathKey ? node.pathKey.split('/').slice(-1)[0] : '';
  const cls = node.classList && node.classList.length ? node.classList[0] : '';
  const label = id || path || cls || `${node.tag}@${node.order}`;
  const group = node.pathKey ? `path:${node.pathKey}` : cls ? `class:${cls}` : '';
  return group ? `${label} <span class="groupKey">${group}</span>` : label;
}

function renderMatchPanel(info: MatchDebugInfo | null) {
  if (!info || !matchDebugInput.checked) {
    matchPanel.style.display = 'none';
    matchPanel.innerHTML = '';
    return;
  }

  const rows = info.pairs
    .map((p) => {
      const startLabel = labelForNode(p.start);
      const endLabel = labelForNode(p.end);
      const cost = p.cost.toFixed(3);
      return `<div class="matchRow"><span>${startLabel}</span><span class="arrow">→</span><span>${endLabel}</span><span class="cost">${cost}</span></div>`;
    })
    .join('');

  const umStart = info.unmatchedStart.map((n) => `<span>${labelForNode(n)}</span>`).join('');
  const umEnd = info.unmatchedEnd.map((n) => `<span>${labelForNode(n)}</span>`).join('');

  matchPanel.innerHTML = `
    <div class="matchHeader">
      <strong>${t('matchPanelTitle')}</strong>
      <span>${info.pairs.length} ${t('matchPairs')} / ${t('matchUnmatched')} ${info.unmatchedStart.length}+${info.unmatchedEnd.length}</span>
    </div>
    <div class="matchBody">
      ${rows || `<div class="matchEmpty">${t('matchEmpty')}</div>`}
    </div>
    <div class="matchFooter">
      <div><em>${t('matchStartUnmatched')}:</em> ${umStart || t('matchEmpty')}</div>
      <div><em>${t('matchEndUnmatched')}:</em> ${umEnd || t('matchEmpty')}</div>
    </div>
  `;
  matchPanel.style.display = 'block';
}

function run({ autoplay }: { autoplay: boolean }) {
  setError(null);
  controller?.destroy();
  controller = null;
  lastMatchInfo = null;
  renderMatchPanel(null);

  const endSvg = endText.value.trim();
  const startSvg = startText.value.trim();

  if (!endSvg) {
    setError('End SVG 不能为空');
    return;
  }

  const duration = Number.parseInt(durationInput.value || '700', 10);
  const easing = parseEasing(easingSelect.value as EasingChoice);
  const samplePoints = Number.parseInt(pointsInput.value || '128', 10);
  const appearStyle = appearSelect.value as 'collapse-to-centroid' | 'bbox-to-shape';
  const morphEngine = engineSelect.value as 'auto' | 'flubber' | 'd3';
  const timeline = timelineSelect.value as 'raf' | 'gsap';
  const layerStagger = Number.parseInt(layerInput.value || '0', 10);
  const gsapEasePreset = gsapEaseSelect.value as 'fast-out-slow-in' | 'slow-in-fast-out' | 'symmetric';
  const intraStagger = Number.parseInt(intraInput.value || '0', 10);
  const motionProfile = motionSelect.value as 'uniform' | 'focus-first' | 'detail-first';
  const propertyTiming = propTimingSelect.value as 'balanced' | 'shape-first' | 'color-lag';
  const toBezier = (t: CurveTuple): BezierCurve => ({ x1: t[0], y1: t[1], x2: t[2], y2: t[3] });
  const propertyCurves = curveToggleInput.checked
    ? {
        shape: toBezier(curveState.shape),
        color: toBezier(curveState.color),
        opacity: toBezier(curveState.opacity),
        stroke: toBezier(curveState.stroke)
      }
    : undefined;
  const matchDebug = matchDebugInput.checked;
  const groupStagger = Number.parseInt(groupInput.value || '0', 10);
  const groupStrategy = groupStrategySelect.value as 'auto' | 'pathKey' | 'class';
  const orbitMode = orbitModeSelect.value as 'off' | 'auto' | 'auto+manual';
  const orbitDirection = orbitDirSelect.value as 'shortest' | 'cw' | 'ccw';
  const orbitTolerance = Number.parseFloat(orbitTolInput.value || '6');
  const orbitSnap = orbitSnapInput.checked;
  const orbitDebug = orbitDebugInput.checked;
  const onProgress = (p: number) => {
    if (!isScrubbing) updateTimelineUI(p);
  };

  try {
    controller = animateSvg({
      container: preview,
      endSvg,
      startSvg: startSvg ? startSvg : undefined,
      options: {
        duration,
        easing,
        samplePoints,
        appearStyle,
        morphEngine,
        timeline,
        layerStagger,
        gsapEasePreset,
        intraStagger,
        motionProfile,
        propertyTiming,
        propertyCurves,
        groupStagger,
        groupStrategy,
        orbitMode,
        orbitDirection,
        orbitTolerance,
        orbitSnap,
        orbitDebug,
        onProgress,
        layerStrategy: 'area',
        onMatchComputed: matchDebug
          ? (info) => {
            lastMatchInfo = info;
            renderMatchPanel(info);
          }
          : undefined
      }
    });

    controller.seek(0);
    updateTimelineUI(0);
    if (autoplay) controller.play();
  } catch (e) {
    setError(e);
  }
}

matchDebugInput.addEventListener('change', () => {
  renderMatchPanel(lastMatchInfo);
});

runBtn.addEventListener('click', () => run({ autoplay: true }));
playBtn.addEventListener('click', () => controller?.play());
pauseBtn.addEventListener('click', () => controller?.pause());
resetBtn.addEventListener('click', () => controller?.seek(0));

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

startText.addEventListener('input', () => renderRawSvg(startPreview, startText.value));
endText.addEventListener('input', () => renderRawSvg(endPreview, endText.value));

// Initial
applyLanguage();
renderRawSvg(startPreview, startText.value);
renderRawSvg(endPreview, endText.value);
run({ autoplay: true });
