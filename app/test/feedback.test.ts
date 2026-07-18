import { describe, expect, it } from 'vitest';

import { buildRecord, exportJsonl, saveRecord } from '../src/feedback.js';
import { ReviewState } from '../src/state.js';
import type { Analysis } from '@engine';

function analysis(canonical: string, probsAt: Record<number, number>): Analysis {
  const probs = new Float32Array([...canonical].length);
  for (const [i, p] of Object.entries(probsAt)) probs[Number(i)] = p;
  return { canonical, probs, warnings: [] };
}

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('feedback records', () => {
  it('captures the FINAL snapshot, not click history', () => {
    const s = new ReviewState('abcdef', analysis('abcdef', { 2: 0.95, 4: 0.4 }), 0.32);
    s.toggle(4);
    s.toggle(4);       // changed mind - back to accept
    s.addAt(1);
    const rec = buildRecord(s, 'test_model');
    expect(rec.final_text).toBe('a b cd ef');
    expect(rec.decisions).toEqual([
      { pos: 1, prob: 0, action: 'add' },
      { pos: 2, prob: expect.closeTo(0.95, 3), action: 'accept' },
      { pos: 4, prob: expect.closeTo(0.4, 3), action: 'accept' },
    ]);
    expect(rec.edited).toBe(false);
  });

  it('latest record for the same input wins', () => {
    const st = memStorage();
    const s1 = new ReviewState('abcdef', analysis('abcdef', { 2: 0.95 }), 0.32);
    s1.toggle(2);
    saveRecord({ ...buildRecord(s1, 'm'), ts: '2026-01-01T00:00:00Z' }, st);
    const s2 = new ReviewState('abcdef', analysis('abcdef', { 2: 0.95 }), 0.32);
    s2.addAt(4);
    saveRecord({ ...buildRecord(s2, 'm'), ts: '2026-01-02T00:00:00Z' }, st);

    const lines = exportJsonl(st).split('\n');
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]);
    expect(rec.ts).toBe('2026-01-02T00:00:00Z');
    expect(rec.final_text).toBe('ab cd ef');
  });

  it('training-pair consistency: stripping final_text spaces gives a valid input', () => {
    const s = new ReviewState('abcdef', analysis('abcdef', { 2: 0.95, 4: 0.4 }), 0.32);
    s.toggle(4);
    const rec = buildRecord(s, 'm');
    expect(rec.final_text.replace(/ /g, '')).toBe(rec.input.replace(/ /g, ''));
  });
});
