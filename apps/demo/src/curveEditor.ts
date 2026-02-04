import type { BezierCurve } from '@svg-smart-animate/core';

type CurveEditorConfig = {
  title: string;
  value: BezierCurve;
  onChange?: (curve: BezierCurve) => void;
};

type CurveEditorHandle = {
  root: HTMLDivElement;
  getValue: () => BezierCurve;
  setValue: (curve: BezierCurve) => void;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function toSvgPoint(curve: BezierCurve, key: 'p1' | 'p2'): { x: number; y: number } {
  const x = key === 'p1' ? curve.x1 : curve.x2;
  const y = key === 'p1' ? curve.y1 : curve.y2;
  return { x: x * 100, y: (1 - y) * 100 };
}

function fromSvgPoint(x: number, y: number): { x: number; y: number } {
  return { x: clamp01(x / 100), y: clamp01(1 - y / 100) };
}

function formatValue(v: number): string {
  return v.toFixed(2);
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, className?: string): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (className) el.setAttribute('class', className);
  return el;
}

export function createCurveEditor(config: CurveEditorConfig): CurveEditorHandle {
  let current: BezierCurve = { ...config.value };

  const root = document.createElement('div');
  root.className = 'curveEditor';

  const header = document.createElement('div');
  header.className = 'curveEditorHeader';
  const title = document.createElement('strong');
  title.textContent = config.title;
  header.appendChild(title);
  root.appendChild(header);

  const inputRow = document.createElement('div');
  inputRow.className = 'curveInputs';
  root.appendChild(inputRow);

  const inputs: Record<keyof BezierCurve, HTMLInputElement> = {
    x1: document.createElement('input'),
    y1: document.createElement('input'),
    x2: document.createElement('input'),
    y2: document.createElement('input')
  };

  (Object.keys(inputs) as Array<keyof BezierCurve>).forEach((key) => {
    const wrap = document.createElement('label');
    wrap.className = 'curveInput';
    wrap.textContent = key;
    const input = inputs[key];
    input.type = 'number';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = formatValue(current[key]);
    wrap.appendChild(input);
    inputRow.appendChild(wrap);
  });

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'curveCanvas';
  root.appendChild(canvasWrap);

  const svg = svgEl('svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  canvasWrap.appendChild(svg);

  for (let i = 0; i <= 100; i += 20) {
    const lineV = svgEl('line', 'curveGridLine');
    lineV.setAttribute('x1', String(i));
    lineV.setAttribute('y1', '0');
    lineV.setAttribute('x2', String(i));
    lineV.setAttribute('y2', '100');
    svg.appendChild(lineV);

    const lineH = svgEl('line', 'curveGridLine');
    lineH.setAttribute('x1', '0');
    lineH.setAttribute('y1', String(i));
    lineH.setAttribute('x2', '100');
    lineH.setAttribute('y2', String(i));
    svg.appendChild(lineH);
  }

  const axis = svgEl('rect', 'curveAxisLine');
  axis.setAttribute('x', '0');
  axis.setAttribute('y', '0');
  axis.setAttribute('width', '100');
  axis.setAttribute('height', '100');
  axis.setAttribute('fill', 'none');
  svg.appendChild(axis);

  const guide1 = svgEl('line', 'curveGuide');
  const guide2 = svgEl('line', 'curveGuide');
  svg.appendChild(guide1);
  svg.appendChild(guide2);

  const path = svgEl('path', 'curvePath');
  svg.appendChild(path);

  const handle1 = svgEl('circle', 'curveHandle');
  handle1.setAttribute('r', '4.5');
  const handle2 = svgEl('circle', 'curveHandle');
  handle2.setAttribute('r', '4.5');
  svg.appendChild(handle1);
  svg.appendChild(handle2);

  const updateSvg = () => {
    const p1 = toSvgPoint(current, 'p1');
    const p2 = toSvgPoint(current, 'p2');
    path.setAttribute('d', `M0 100 C ${p1.x} ${p1.y} ${p2.x} ${p2.y} 100 0`);
    guide1.setAttribute('x1', '0');
    guide1.setAttribute('y1', '100');
    guide1.setAttribute('x2', String(p1.x));
    guide1.setAttribute('y2', String(p1.y));
    guide2.setAttribute('x1', '100');
    guide2.setAttribute('y1', '0');
    guide2.setAttribute('x2', String(p2.x));
    guide2.setAttribute('y2', String(p2.y));
    handle1.setAttribute('cx', String(p1.x));
    handle1.setAttribute('cy', String(p1.y));
    handle2.setAttribute('cx', String(p2.x));
    handle2.setAttribute('cy', String(p2.y));
    inputs.x1.value = formatValue(current.x1);
    inputs.y1.value = formatValue(current.y1);
    inputs.x2.value = formatValue(current.x2);
    inputs.y2.value = formatValue(current.y2);
  };

  const setCurve = (next: BezierCurve, emit = true) => {
    current = {
      x1: clamp01(next.x1),
      y1: clamp01(next.y1),
      x2: clamp01(next.x2),
      y2: clamp01(next.y2)
    };
    updateSvg();
    if (emit && config.onChange) config.onChange({ ...current });
  };

  const readInput = () => {
    setCurve(
      {
        x1: Number.parseFloat(inputs.x1.value),
        y1: Number.parseFloat(inputs.y1.value),
        x2: Number.parseFloat(inputs.x2.value),
        y2: Number.parseFloat(inputs.y2.value)
      },
      true
    );
  };

  (Object.values(inputs) as HTMLInputElement[]).forEach((input) => {
    input.addEventListener('change', readInput);
    input.addEventListener('input', readInput);
  });

  let active: 'p1' | 'p2' | null = null;

  const startDrag = (key: 'p1' | 'p2') => (event: PointerEvent) => {
    event.preventDefault();
    active = key;
    (event.target as Element).setPointerCapture(event.pointerId);
    updateFromEvent(event);
  };

  const updateFromEvent = (event: PointerEvent) => {
    if (!active) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const next = fromSvgPoint(x, y);
    if (active === 'p1') {
      setCurve({ ...current, x1: next.x, y1: next.y }, true);
    } else {
      setCurve({ ...current, x2: next.x, y2: next.y }, true);
    }
  };

  const stopDrag = () => {
    active = null;
  };

  handle1.addEventListener('pointerdown', startDrag('p1'));
  handle2.addEventListener('pointerdown', startDrag('p2'));
  svg.addEventListener('pointermove', updateFromEvent);
  svg.addEventListener('pointerup', stopDrag);
  svg.addEventListener('pointerleave', stopDrag);

  updateSvg();

  return {
    root,
    getValue: () => ({ ...current }),
    setValue: (curve: BezierCurve) => setCurve(curve, false)
  };
}
