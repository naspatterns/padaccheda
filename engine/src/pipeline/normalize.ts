import type { SplitWarning } from '../engine/types.js';

export interface Normalized {
  /** NFC-normalized input; the output string is built from this */
  canonical: string;
  /** 1:1 per-canonical-char model view (lowercased, apostrophes folded) */
  modelChars: string[];
  warnings: SplitWarning[];
}

const APOSTROPHES = /[‘’ʼʻ`´]/; // ' ' ʼ ʻ ` ´
const DEVANAGARI = /[ऀ-ॿ]/;
// exact IAST Latin inventory: f q w x z never occur in IAST transliteration
const IAST_LETTER = /[abcdeghijklmnoprstuvyāīūṛṝḷḹṃḥṅñṭḍṇśṣ]/;

export function normalize(input: string): Normalized {
  const canonical = input.normalize('NFC');
  const modelChars: string[] = [];
  const warnings: SplitWarning[] = [];

  let letters = 0;
  let nonIast = 0;
  let uppercase = 0;
  let devanagari = false;

  for (const ch of canonical) {
    let m = ch;
    if (APOSTROPHES.test(m)) m = "'";
    const lower = m.toLowerCase();
    if (lower.length === 1) {
      if (lower !== m && /\p{L}/u.test(m)) uppercase++;
      m = lower;
    }
    modelChars.push(m);

    if (DEVANAGARI.test(m)) devanagari = true;
    if (/\p{L}/u.test(m)) {
      letters++;
      if (!IAST_LETTER.test(m)) nonIast++;
    }
  }

  if (devanagari) warnings.push({ code: 'devanagari' });
  if (letters > 0 && nonIast / letters > 0.1) {
    warnings.push({ code: 'non-iast', detail: `${nonIast}/${letters} letters` });
  }
  if (letters > 0 && uppercase / letters > 0.3) {
    warnings.push({ code: 'uppercase' });
  }
  return { canonical, modelChars, warnings };
}
