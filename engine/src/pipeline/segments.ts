/** Sanskrit-letter runs vs verbatim passthrough segments.
 *
 * Runs are maximal spans of IAST letters/avagraha in the MODEL view.
 * Everything else (existing spaces, daṇḍa, digits, newlines, Devanagari...)
 * passes through untouched; existing spaces therefore act as hard word
 * boundaries the model never sees across.
 */

export interface Segment {
  type: 'run' | 'pass';
  /** [start, end) into the canonical string / modelChars array */
  start: number;
  end: number;
}

const RUN_CHAR = /[a-zāīūṛṝḷḹṃḥṅñṭḍṇśṣ']/;

export function segment(modelChars: string[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  const n = modelChars.length;
  while (i < n) {
    const isRun = RUN_CHAR.test(modelChars[i]);
    let j = i + 1;
    while (j < n && RUN_CHAR.test(modelChars[j]) === isRun) j++;
    out.push({ type: isRun ? 'run' : 'pass', start: i, end: j });
    i = j;
  }
  return out;
}

/** Windowing plan for long runs: 1024-char windows, 64-char overlap;
 *  each position's probability is taken from the window where it is most
 *  central (i.e. windows own [start+64, end-64) except at run edges). */
export const WINDOW = 1024;
export const OVERLAP = 64;
export const MAX_DIRECT = 2048;

export interface Window {
  /** [start, end) slice of the run to run inference on */
  start: number;
  end: number;
  /** [takeStart, takeEnd) positions whose probs this window owns */
  takeStart: number;
  takeEnd: number;
}

export function planWindows(runLen: number): Window[] {
  if (runLen <= MAX_DIRECT) {
    return [{ start: 0, end: runLen, takeStart: 0, takeEnd: runLen }];
  }
  const windows: Window[] = [];
  let start = 0;
  while (true) {
    const end = Math.min(start + WINDOW, runLen);
    windows.push({
      start,
      end,
      takeStart: start === 0 ? 0 : start + OVERLAP,
      takeEnd: end === runLen ? runLen : end - OVERLAP,
    });
    if (end === runLen) break;
    start = end - 2 * OVERLAP;
  }
  return windows;
}
