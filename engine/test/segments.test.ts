import { describe, expect, it } from 'vitest';

import { planWindows, segment } from '../src/pipeline/segments.js';

const chars = (s: string) => [...s];

describe('segment', () => {
  it('round-trips mixed text and isolates runs', () => {
    const s = 'rāmo gacchati | vanaṃ 12 ॥ deva';
    const segs = segment(chars(s));
    const rebuilt = segs.map((g) => s.slice(g.start, g.end)).join('');
    expect(rebuilt).toBe(s);
    const runs = segs.filter((g) => g.type === 'run')
      .map((g) => s.slice(g.start, g.end));
    expect(runs).toEqual(['rāmo', 'gacchati', 'vanaṃ', 'deva']);
  });

  it('treats existing spaces as hard boundaries (pass segments)', () => {
    const segs = segment(chars('ab cd'));
    expect(segs).toEqual([
      { type: 'run', start: 0, end: 2 },
      { type: 'pass', start: 2, end: 3 },
      { type: 'run', start: 3, end: 5 },
    ]);
  });

  it('keeps avagraha inside a run', () => {
    const segs = segment(chars("so'bravīt"));
    expect(segs).toEqual([{ type: 'run', start: 0, end: 9 }]);
  });
});

describe('planWindows', () => {
  it('short runs get a single full window', () => {
    expect(planWindows(2048)).toEqual([
      { start: 0, end: 2048, takeStart: 0, takeEnd: 2048 },
    ]);
  });

  it('long runs tile with overlap and cover every position exactly once', () => {
    const n = 5000;
    const ws = planWindows(n);
    expect(ws.length).toBeGreaterThan(1);
    const owned = new Int32Array(n);
    for (const w of ws) {
      expect(w.end - w.start).toBeLessThanOrEqual(1024);
      for (let k = w.takeStart; k < w.takeEnd; k++) owned[k]++;
      // owned region lies inside the inference window
      expect(w.takeStart).toBeGreaterThanOrEqual(w.start);
      expect(w.takeEnd).toBeLessThanOrEqual(w.end);
    }
    expect(owned.every((c) => c === 1)).toBe(true);
  });
});
