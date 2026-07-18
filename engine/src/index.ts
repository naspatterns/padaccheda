import { SpaceCnn } from './engine/cnn.js';
import { loadWeights } from './engine/weights.js';
import type {
  Analysis, Manifest, SplitOptions, SplitResult,
} from './engine/types.js';
import { normalize } from './pipeline/normalize.js';
import { planWindows, segment } from './pipeline/segments.js';
import { decide } from './pipeline/decide.js';

export type {
  Analysis, Manifest, NearMiss, SpaceSpan, SplitOptions, SplitResult,
  SplitWarning, WarningCode,
} from './engine/types.js';
export { decide } from './pipeline/decide.js';

export interface Splitter {
  readonly defaultThreshold: number;
  /** Run inference once; reuse the Analysis across thresholds via decide(). */
  analyze(text: string): Analysis;
  /** analyze + decide in one call. */
  split(text: string, opts?: SplitOptions): SplitResult;
}

/**
 * Create a splitter from the model manifest and the raw fp32 weights blob.
 * IO-free: the caller fetches/reads both (browser: fetch, Node: fs).
 */
export function createSplitter(
  manifest: Manifest, weightsBuf: ArrayBuffer): Splitter {
  const cnn = new SpaceCnn(manifest, loadWeights(manifest, weightsBuf));
  const defaultThreshold = manifest.default_threshold;

  function analyze(text: string): Analysis {
    const norm = normalize(text);
    const probs = new Float32Array(norm.modelChars.length);
    for (const seg of segment(norm.modelChars)) {
      if (seg.type !== 'run') continue;
      const runLen = seg.end - seg.start;
      if (runLen < 2) continue;
      const ids = cnn.encode(norm.modelChars.slice(seg.start, seg.end));
      for (const w of planWindows(runLen)) {
        const p = cnn.infer(ids.subarray(w.start, w.end));
        for (let k = w.takeStart; k < w.takeEnd; k++) {
          probs[seg.start + k] = p[k - w.start];
        }
      }
      probs[seg.start] = 0; // never insert before the run's first char
    }
    return { canonical: norm.canonical, probs, warnings: norm.warnings };
  }

  return {
    defaultThreshold,
    analyze,
    split(text: string, opts?: SplitOptions): SplitResult {
      return decide(analyze(text), opts?.threshold ?? defaultThreshold);
    },
  };
}
