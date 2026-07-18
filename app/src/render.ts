/** Result-pane renderer: canonical text with clickable juncture marks. */
import { gradeOf, isCandidate } from './grades.js';
import type { ReviewState } from './state.js';

export interface RenderCallbacks {
  onToggle(pos: number): void;
  onAdd(pos: number): void;
}

/** Positions worth the user's attention, in document order. */
export function attentionPositions(state: ReviewState, showCandidates: boolean): number[] {
  const out: number[] = [];
  for (const s of state.spans()) {
    if (s.kind === 'engine' && gradeOf(s.prob) !== 'high') out.push(s.pos);
  }
  if (showCandidates) {
    for (const c of candidatePositions(state)) out.push(c);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function candidatePositions(state: ReviewState): number[] {
  const engine = new Set(state.spans().map((s) => s.pos));
  const out: number[] = [];
  const { probs } = state.analysis;
  for (let i = 1; i < probs.length; i++) {
    if (!engine.has(i) && isCandidate(probs[i], state.threshold)) out.push(i);
  }
  return out;
}

export function renderResult(
  container: HTMLElement,
  state: ReviewState,
  showCandidates: boolean,
  cb: RenderCallbacks,
) {
  container.textContent = '';
  const frag = document.createDocumentFragment();
  const chars = [...state.analysis.canonical];
  const spanAt = new Map(state.spans().map((s) => [s.pos, s]));
  const candSet = new Set(showCandidates ? candidatePositions(state) : []);

  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      frag.appendChild(document.createTextNode(buf.join('')));
      buf = [];
    }
  };

  for (let i = 0; i < chars.length; i++) {
    const s = spanAt.get(i);
    if (s) {
      flush();
      const el = document.createElement('span');
      const grade = s.kind === 'added' ? 'added' : gradeOf(s.prob);
      el.className = `sp ${grade}${s.rejected ? ' rejected' : ''}`;
      el.dataset.pos = String(i);
      el.title = s.kind === 'added'
        ? 'added by you — click to remove'
        : `p=${s.prob.toFixed(2)} — click to ${s.rejected ? 'restore' : 'remove'}`;
      el.textContent = s.rejected ? '×' : ' ';
      frag.appendChild(el);
    } else if (candSet.has(i)) {
      flush();
      const el = document.createElement('span');
      el.className = 'cand';
      el.dataset.cand = String(i);
      el.title = `candidate (p=${state.analysis.probs[i].toFixed(2)}) — click to insert a space`;
      el.textContent = '·';
      frag.appendChild(el);
    }
    buf.push(chars[i]);
  }
  flush();
  container.appendChild(frag);

  container.onclick = (ev) => {
    const t = ev.target as HTMLElement;
    if (t.dataset.pos !== undefined) cb.onToggle(Number(t.dataset.pos));
    else if (t.dataset.cand !== undefined) cb.onAdd(Number(t.dataset.cand));
  };
}

export function summaryLine(state: ReviewState, showCandidates: boolean): string {
  let high = 0, mid = 0, low = 0, rejected = 0, added = 0;
  for (const s of state.spans()) {
    if (s.rejected) { rejected++; continue; }
    if (s.kind === 'added') { added++; continue; }
    const g = gradeOf(s.prob);
    if (g === 'high') high++;
    else if (g === 'mid') mid++;
    else low++;
  }
  const parts = [
    `${high + mid + low} spaces: ${high} high · ${mid} mid · ${low} low`,
  ];
  if (added) parts.push(`${added} added`);
  if (rejected) parts.push(`${rejected} removed`);
  if (showCandidates) parts.push(`${candidatePositions(state).length} candidates`);
  return parts.join(' | ');
}
