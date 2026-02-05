import './styles.css';
import { animateSvg, easeInOutCubic, linear, type AnimateController, type MatchDebugInfo, type BezierCurve } from '@svg-smart-animate/core';
import { Pane } from 'tweakpane';
import * as CubicBezierPlugin from '@tweakpane/plugin-cubic-bezier';

const sampleStart = `<svg viewBox="0 0 100 100">
  <rect id="shape" x="12" y="18" width="32" height="24" rx="6" fill="#7CFCFF"/>
  <circle id="dot" cx="70" cy="70" r="8" fill="#FFD166"/>
</svg>`;

const sampleEnd = `<svg viewBox="0 0 100 100">
  <circle id="shape" cx="70" cy="40" r="18" fill="#7CFCFF"/>
  <rect id="dot" x="18" y="62" width="34" height="18" rx="9" fill="#FFD166"/>
</svg>`;

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
brand.innerHTML = `<h1>svg-smart-animate</h1><p>粘贴 SVG（start / end），一键预览 Smart Animate 形变。</p>`;
header.appendChild(brand);

const buttonRow = el('div', 'buttonRow');
header.appendChild(buttonRow);

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

const left = el('div', 'card');
container.appendChild(left);

const leftHeader = el('div', 'cardHeader');
left.appendChild(leftHeader);
leftHeader.innerHTML = `<strong>输入</strong>`;

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

const linearCurve: BezierCurve = { x1: 0, y1: 0, x2: 1, y2: 1 };
const curveState = {
  shape: { ...linearCurve },
  color: { ...linearCurve },
  opacity: { ...linearCurve },
  stroke: { ...linearCurve }
};

const curvePane = new Pane({ container: curvePaneWrap });
curvePane.registerPlugin(CubicBezierPlugin);

const addCurveFolder = (title: string, key: keyof typeof curveState) => {
  const folder = curvePane.addFolder({ title });
  folder.addBinding(curveState, key, { view: 'cubicBezier' }).on('change', (ev) => {
    curveState[key] = ev.value as BezierCurve;
  });
};

addCurveFolder('形状', 'shape');
addCurveFolder('颜色', 'color');
addCurveFolder('透明度', 'opacity');
addCurveFolder('描边', 'stroke');

function syncCurvePanel() {
  curvePanel.style.display = curveToggleInput.checked ? 'block' : 'none';
}
curveToggleInput.addEventListener('change', syncCurvePanel);
syncCurvePanel();
const split = el('div', 'split');
left.appendChild(split);

const startPanel = el('div');
split.appendChild(startPanel);
startPanel.innerHTML = `<div style="padding:10px 0 8px; color: var(--muted); font-size:12px;">Start SVG（可留空：将触发单 SVG 出现）</div>`;
const startText = el('textarea');
startText.value = sampleStart;
startPanel.appendChild(startText);
const startPreview = el('div', 'miniPreview');
startPanel.appendChild(startPreview);

const endPanel = el('div');
split.appendChild(endPanel);
endPanel.innerHTML = `<div style="padding:10px 0 8px; color: var(--muted); font-size:12px;">End SVG</div>`;
const endText = el('textarea');
endText.value = sampleEnd;
endPanel.appendChild(endText);
const endPreview = el('div', 'miniPreview');
endPanel.appendChild(endPreview);

const right = el('div', 'card');
container.appendChild(right);

const rightHeader = el('div', 'cardHeader');
right.appendChild(rightHeader);
rightHeader.innerHTML = `<strong>预览</strong>`;

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

function renderRawSvg(target: HTMLDivElement, svgText: string) {
  target.innerHTML = '';
  const trimmed = svgText.trim();
  if (!trimmed) {
    target.innerHTML = `<div style="color: var(--muted); font-size: 12px;">（空）</div>`;
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
      <strong>匹配可视化</strong>
      <span>${info.pairs.length} 对 / 未匹配 ${info.unmatchedStart.length}+${info.unmatchedEnd.length}</span>
    </div>
    <div class="matchBody">
      ${rows || `<div class="matchEmpty">（无匹配对）</div>`}
    </div>
    <div class="matchFooter">
      <div><em>Start 未匹配:</em> ${umStart || '无'}</div>
      <div><em>End 未匹配:</em> ${umEnd || '无'}</div>
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
  const propertyCurves = curveToggleInput.checked ? curveState : undefined;
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
renderRawSvg(startPreview, startText.value);
renderRawSvg(endPreview, endText.value);
run({ autoplay: true });
