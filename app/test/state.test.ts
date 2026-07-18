import { describe, expect, it } from 'vitest';

import { ReviewState } from '../src/state.js';
import type { Analysis } from '@engine';

function analysis(canonical: string, probsAt: Record<number, number>): Analysis {
  const probs = new Float32Array([...canonical].length);
  for (const [i, p] of Object.entries(probsAt)) probs[Number(i)] = p;
  return { canonical, probs, warnings: [] };
}

const mk = () =>
  new ReviewState('abcdef', analysis('abcdef', { 2: 0.95, 4: 0.4 }), 0.32);

describe('ReviewState', () => {
  it('renders engine cuts and final text', () => {
    const s = mk();
    expect(s.spans().map((x) => x.pos)).toEqual([2, 4]);
    expect(s.finalText()).toBe('ab cd ef');
  });

  it('toggle rejects and restores; undo/redo works', () => {
    const s = mk();
    s.toggle(4);
    expect(s.finalText()).toBe('ab cdef');
    s.toggle(4);
    expect(s.finalText()).toBe('ab cd ef');
    s.toggle(2);
    expect(s.finalText()).toBe('abcd ef');
    expect(s.undo()).toBe(true);
    expect(s.finalText()).toBe('ab cd ef');
    expect(s.redo()).toBe(true);
    expect(s.finalText()).toBe('abcd ef');
  });

  it('addAt inserts a user space; toggle removes it', () => {
    const s = mk();
    s.addAt(1);
    expect(s.finalText()).toBe('a b cd ef');
    expect(s.spans().find((x) => x.pos === 1)?.kind).toBe('added');
    s.toggle(1);
    expect(s.finalText()).toBe('ab cd ef');
  });

  it('threshold change keeps overrides', () => {
    const s = mk();
    s.toggle(2);                       // reject the high cut
    s.setThreshold(0.5);               // 0.4-cut disappears from engine set
    expect(s.finalText()).toBe('abcdef');
    s.setThreshold(0.32);
    expect(s.finalText()).toBe('abcd ef');   // rejection persisted
  });

  it('free edit takes over final text; reset restores engine output', () => {
    const s = mk();
    s.applyEdit('ab code ef!');
    expect(s.finalText()).toBe('ab code ef!');
    expect(s.hasUserActions()).toBe(true);
    s.reset();
    expect(s.finalText()).toBe('ab cd ef');
  });

  it('surface preservation: final text minus spaces equals canonical minus spaces', () => {
    const s = mk();
    s.addAt(1);
    s.toggle(2);
    expect(s.finalText().replace(/ /g, ''))
      .toBe(s.analysis.canonical.replace(/ /g, ''));
  });
});
