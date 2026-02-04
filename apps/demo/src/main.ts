import './styles.css';
import { animateSvg, easeInOutCubic, linear, type AnimateController } from '@svg-smart-animate/core';

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

const layerWrap = el('label', 'control');
layerWrap.innerHTML = `分层延迟(ms) <input type="number" min="0" step="10" value="70" />`;
controls.appendChild(layerWrap);
const layerInput = layerWrap.querySelector<HTMLInputElement>('input')!;

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

const previewWrap = el('div', 'previewWrap');
right.appendChild(previewWrap);

const preview = el('div', 'preview');
previewWrap.appendChild(preview);

const errorBox = el('div', 'error');
errorBox.style.display = 'none';
right.appendChild(errorBox);

let controller: AnimateController | null = null;

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
    target.innerHTML = `<div style="color: var(--danger); font-family: var(--mono); font-size: 12px; padding: 10px;">${
      e instanceof Error ? e.message : String(e)
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

function run({ autoplay }: { autoplay: boolean }) {
  setError(null);
  controller?.destroy();
  controller = null;

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
        layerStrategy: 'area'
      }
    });

    controller.seek(0);
    if (autoplay) controller.play();
  } catch (e) {
    setError(e);
  }
}

runBtn.addEventListener('click', () => run({ autoplay: true }));
playBtn.addEventListener('click', () => controller?.play());
pauseBtn.addEventListener('click', () => controller?.pause());
resetBtn.addEventListener('click', () => controller?.seek(0));

startText.addEventListener('input', () => renderRawSvg(startPreview, startText.value));
endText.addEventListener('input', () => renderRawSvg(endPreview, endText.value));

// Initial
renderRawSvg(startPreview, startText.value);
renderRawSvg(endPreview, endText.value);
run({ autoplay: true });
