/** Correction records: localStorage persistence + JSONL export.
 *
 * A record is the FINAL snapshot of one reviewed run (not the click history).
 * Records are keyed by input text - re-exporting the same input replaces the
 * older record (latest-wins), so later changes of mind supersede earlier ones.
 */
import type { ReviewState } from './state.js';

const LS_KEY = 'padaccheda_feedback_v1';

export interface Decision {
  pos: number;
  prob: number;
  action: 'accept' | 'reject' | 'add';
}

export interface CorrectionRecord {
  ts: string;
  model_tag: string;
  threshold: number;
  input: string;
  final_text: string;
  edited: boolean;
  decisions: Decision[];
}

export function buildRecord(state: ReviewState, modelTag: string): CorrectionRecord {
  const decisions: Decision[] = state.spans().map((s) => ({
    pos: s.pos,
    prob: Number(s.prob.toFixed(4)),
    action: s.kind === 'added' ? 'add' : (s.rejected ? 'reject' : 'accept'),
  }));
  return {
    ts: new Date().toISOString(),
    model_tag: modelTag,
    threshold: state.threshold,
    input: state.input,
    final_text: state.finalText(),
    edited: state.editedText !== null,
    decisions,
  };
}

type Store = Record<string, CorrectionRecord>;   // key = input text

function load(storage: Pick<Storage, 'getItem' | 'setItem'>): Store {
  try {
    return JSON.parse(storage.getItem(LS_KEY) || '{}') as Store;
  } catch {
    return {};
  }
}

export function saveRecord(
  rec: CorrectionRecord,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
) {
  const store = load(storage);
  store[rec.input] = rec;                        // latest wins
  storage.setItem(LS_KEY, JSON.stringify(store));
}

export function recordCount(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): number {
  return Object.keys(load(storage)).length;
}

export function exportJsonl(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): string {
  const store = load(storage);
  return Object.values(store)
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((r) => JSON.stringify(r))
    .join('\n');
}

// ---- output helpers -----------------------------------------------------

export function downloadText(name: string, content: string, bom = false) {
  const parts: BlobPart[] = bom ? ['\uFEFF', content] : [content];
  const blob = new Blob(parts, { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}`;
}
