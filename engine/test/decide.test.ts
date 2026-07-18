import { describe, expect, it } from 'vitest';

import { decide } from '../src/pipeline/decide.js';
import type { Analysis } from '../src/engine/types.js';

function analysis(canonical: string, probsAt: Record<number, number>): Analysis {
  const probs = new Float32Array([...canonical].length);
  for (const [i, p] of Object.entries(probsAt)) probs[Number(i)] = p;
  return { canonical, probs, warnings: [] };
}

describe('decide', () => {
  it('inserts spaces at positions >= threshold with confidence bands', () => {
    const a = analysis('abcdef', { 2: 0.9, 4: 0.3 });
    const r = decide(a, 0.24);
    expect(r.text).toBe('ab cd ef');
    expect(r.spans).toHaveLength(2);
    expect(r.spans[0]).toMatchObject({ pos: 2, outPos: 2, band: 'confident' });
    expect(r.spans[1]).toMatchObject({ pos: 4, outPos: 5, band: 'low' });
    expect(r.ok).toBe(true);
  });

  it('collects near-misses just below threshold', () => {
    const a = analysis('abcdef', { 2: 0.2, 4: 0.05 });
    const r = decide(a, 0.24);
    expect(r.text).toBe('abcdef');
    expect(r.nearMisses).toEqual([
      { pos: 2, prob: expect.closeTo(0.2, 5) },
    ]);
  });

  it('same analysis re-decides at different thresholds without inference', () => {
    const a = analysis('abcdef', { 2: 0.4, 4: 0.3 });
    expect(decide(a, 0.5).spans).toHaveLength(0);
    expect(decide(a, 0.35).spans).toHaveLength(1);
    expect(decide(a, 0.24).spans).toHaveLength(2);
  });

  it('property: output minus spaces always equals input minus spaces', () => {
    const rnd = (seed: number) => () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const rand = rnd(7);
    const alphabet = [..."aāiīuūṛeokgcjtdnpbmyrlvsśṣhṃḥ' ।|1"];
    for (let trial = 0; trial < 50; trial++) {
      const len = 1 + Math.floor(rand() * 80);
      const s = Array.from(
        { length: len },
        () => alphabet[Math.floor(rand() * alphabet.length)]).join('');
      const probsAt: Record<number, number> = {};
      for (let i = 1; i < len; i++) {
        if (rand() < 0.3) probsAt[i] = rand();
      }
      const r = decide(analysis(s, probsAt), 0.24);
      expect(r.ok).toBe(true);
      expect(r.text.replace(/ /g, '')).toBe(s.replace(/ /g, ''));
    }
  });
});
