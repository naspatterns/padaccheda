import type {
  Analysis, NearMiss, SpaceSpan, SplitResult, SplitWarning,
} from '../engine/types.js';

const CONFIDENT_MARGIN = 0.15;
const NEAR_MISS_FLOOR = 0.1;

/** Apply a threshold to an Analysis and assemble the output string.
 *  Pure and cheap: callers may re-run it with different thresholds without
 *  re-running inference. */
export function decide(analysis: Analysis, threshold: number): SplitResult {
  const { canonical, probs } = analysis;
  const warnings: SplitWarning[] = [...analysis.warnings];
  const spans: SpaceSpan[] = [];
  const nearMisses: NearMiss[] = [];

  const chars = [...canonical];
  const parts: string[] = [];
  let outLen = 0;
  for (let i = 0; i < chars.length; i++) {
    const p = probs[i];
    if (p >= threshold) {
      spans.push({
        pos: i,
        outPos: outLen,
        prob: p,
        band: p >= threshold + CONFIDENT_MARGIN ? 'confident' : 'low',
      });
      parts.push(' ');
      outLen++;
    } else if (p >= Math.max(NEAR_MISS_FLOOR, threshold - CONFIDENT_MARGIN)) {
      nearMisses.push({ pos: i, prob: p });
    }
    parts.push(chars[i]);
    outLen += chars[i].length;
  }
  const text = parts.join('');

  // surface-preservation invariant: never alter anything but spaces
  const strip = (s: string) => s.replace(/ /g, '');
  let ok = true;
  if (strip(text) !== strip(canonical)) {
    ok = false;
    warnings.push({ code: 'invariant' });
    return {
      text: canonical, spans: [], nearMisses: [], warnings, threshold, ok,
    };
  }
  return { text, spans, nearMisses, warnings, threshold, ok };
}
