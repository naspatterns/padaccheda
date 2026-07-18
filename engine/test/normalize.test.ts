import { describe, expect, it } from 'vitest';

import { normalize } from '../src/pipeline/normalize.js';

describe('normalize', () => {
  it('NFD input becomes NFC and model view matches', () => {
    const nfd = 'rāma';                    // rāma with combining macron
    const n = normalize(nfd);
    expect(n.canonical).toBe('rāma');
    expect(n.modelChars.join('')).toBe('rāma');
    expect(n.modelChars.length).toBe(4);
  });

  it('folds curly apostrophes to ASCII in the model view only', () => {
    const n = normalize('so ’bravīt');
    expect(n.canonical).toBe('so ’bravīt');  // canonical untouched
    expect(n.modelChars[3]).toBe("'");
  });

  it('folds IAST capitals 1:1', () => {
    const n = normalize('Rāmo Gacchati Ā');
    expect(n.modelChars.join('')).toBe('rāmo gacchati ā');
    expect(n.canonical).toBe('Rāmo Gacchati Ā');
  });

  it('flags Devanagari', () => {
    const n = normalize('rāma देव');
    expect(n.warnings.some((w) => w.code === 'devanagari')).toBe(true);
  });

  it('flags heavily non-IAST latin text', () => {
    const n = normalize('the quick brown fox jumps over the lazy dog xxxx');
    // f, w, x, q are not IAST letters
    expect(n.warnings.some((w) => w.code === 'non-iast')).toBe(true);
  });

  it('clean IAST produces no warnings', () => {
    const n = normalize("dharmakṣetre kurukṣetre so 'bravīt gajenāgacchati");
    expect(n.warnings).toEqual([]);
  });
});
