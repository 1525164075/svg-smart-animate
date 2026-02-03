import { describe, it, expect } from 'vitest';
import { matchNodes } from './match';
import type { NormalizedPathNode } from './normalize';
import { shapeToPath } from './shapeToPath';

function rectPath(x: number): string {
  return shapeToPath('rect', { x: String(x), y: '0', width: '10', height: '10' })!;
}

function node(id: string, d: string, attrs: Record<string, string>): NormalizedPathNode {
  return {
    id,
    tag: 'path',
    d,
    fill: attrs.fill,
    stroke: attrs.stroke,
    opacity: attrs.opacity ? Number.parseFloat(attrs.opacity) : undefined,
    attrs
  };
}

describe('matchNodes', () => {
  it('prefers stable id/name matches over geometry', () => {
    const start: NormalizedPathNode[] = [
      node('a', rectPath(0), { id: 'a' }),
      node('b', rectPath(100), { id: 'b' })
    ];

    // swapped positions: geometry would want cross-match, but ids should win
    const end: NormalizedPathNode[] = [
      node('a', rectPath(100), { id: 'a' }),
      node('b', rectPath(0), { id: 'b' })
    ];

    const res = matchNodes(start, end);

    const map = new Map(res.pairs.map((p) => [p.start.attrs.id, p.end.attrs.id]));
    expect(map.get('a')).toBe('a');
    expect(map.get('b')).toBe('b');
  });

  it('matches remaining nodes by nearest center when no stable keys', () => {
    const start: NormalizedPathNode[] = [
      node('s1', rectPath(0), {}),
      node('s2', rectPath(100), {})
    ];

    const end: NormalizedPathNode[] = [
      node('e1', rectPath(5), {}),
      node('e2', rectPath(105), {})
    ];

    const res = matchNodes(start, end);
    expect(res.pairs.length).toBe(2);

    // Verify each start matches its nearest end by comparing bbox centers indirectly via cost.
    const byStartId = new Map(res.pairs.map((p) => [p.start.id, p.end.id]));
    expect(byStartId.get('s1')).toBe('e1');
    expect(byStartId.get('s2')).toBe('e2');
  });
});
