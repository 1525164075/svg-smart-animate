import svgpath from 'svgpath';

export function applyTransformToPathD(d: string, transform: string | undefined): string {
  if (!transform || transform.trim() === '') return d;

  // svgpath parses SVG transform syntax (matrix/translate/scale/rotate/skewX/skewY).
  return svgpath(d).transform(transform).toString();
}
