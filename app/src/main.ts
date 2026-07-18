import './style.css';
import { ReviewState } from './state.js';
import {
  attentionPositions, renderResult, summaryLine,
} from './render.js';
import {
  buildRecord, downloadText, exportJsonl, recordCount, saveRecord, stamp,
  submitRecord, getClientId, getShareConsent, setShareConsent,
  noticeSeen, markNoticeSeen, collectionConfigured,
} from './feedback.js';
import type { CorrectionRecord } from './feedback.js';
import type { SplitWarning } from '@engine';

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const els = {
  divide: $<HTMLButtonElement>('divide'),
  status: $<HTMLSpanElement>('status'),
  input: $<HTMLTextAreaElement>('input'),
  result: $<HTMLDivElement>('result'),
  summary: $<HTMLDivElement>('summary'),
  warnings: $<HTMLDivElement>('warnings'),
  copyBtn: $<HTMLButtonElement>('copyBtn'),
  downloadBtn: $<HTMLButtonElement>('downloadBtn'),
  exportBtn: $<HTMLButtonElement>('exportBtn'),
  resetBtn: $<HTMLButtonElement>('resetBtn'),
  showCandidates: $<HTMLInputElement>('showCandidates'),
  editMode: $<HTMLInputElement>('editMode'),
  threshold: $<HTMLInputElement>('threshold'),
  thresholdVal: $<HTMLSpanElement>('thresholdVal'),
  charCount: $<HTMLSpanElement>('charCount'),
  shareData: $<HTMLInputElement>('shareData'),
  notice: $<HTMLDivElement>('notice'),
  noticeOk: $<HTMLButtonElement>('noticeOk'),
  noticeOff: $<HTMLButtonElement>('noticeOff'),
};

const worker = new Worker(new URL('./worker.ts', import.meta.url),
  { type: 'module' });

let modelTag = '';
let state: ReviewState | null = null;
let attnIndex = -1;
let reqId = 0;

function setStatus(s: string) {
  els.status.textContent = s;
}

function showWarnings(warnings: SplitWarning[]) {
  const msgs: string[] = [];
  for (const w of warnings) {
    if (w.code === 'devanagari') {
      msgs.push('Devanagari detected — this tool divides IAST text only; other scripts pass through unchanged.');
    } else if (w.code === 'non-iast') {
      msgs.push(`Many non-IAST letters (${w.detail ?? ''}) — those regions are left undivided.`);
    } else if (w.code === 'uppercase') {
      msgs.push('Uppercase-heavy input — Harvard-Kyoto? Convert to IAST first.');
    } else if (w.code === 'invariant') {
      msgs.push('Internal check failed; input returned unchanged.');
    }
  }
  els.warnings.hidden = msgs.length === 0;
  els.warnings.textContent = msgs.join('  ');
}

function rerender() {
  if (!state) return;
  if (els.editMode.checked) {
    els.result.contentEditable = 'plaintext-only';
    els.result.classList.add('editing');
  } else {
    els.result.contentEditable = 'false';
    els.result.classList.remove('editing');
  }
  if (state.editedText !== null || els.editMode.checked) {
    // edited world: plain text, no structured marks
    if (document.activeElement !== els.result) {
      els.result.textContent = state.finalText();
    }
    els.summary.textContent = state.editedText !== null
      ? 'edited manually — structured marks disabled (Reset to restore)'
      : summaryLine(state, els.showCandidates.checked);
    return;
  }
  renderResult(els.result, state, els.showCandidates.checked, {
    onToggle(pos) { state!.toggle(pos); rerender(); },
    onAdd(pos) { state!.addAt(pos); rerender(); },
  });
  els.summary.textContent = summaryLine(state, els.showCandidates.checked);
}

// input text -> last submitted final_text, to skip re-sending unchanged records
// (autosave fires on every divide / copy / download / unload).
const lastSent = new Map<string, string>();

function maybeSubmit(rec: CorrectionRecord) {
  if (!getShareConsent()) return;
  if (lastSent.get(rec.input) === rec.final_text) return;
  lastSent.set(rec.input, rec.final_text);
  void submitRecord(rec, getClientId());   // best-effort, fire-and-forget
}

function autosave() {
  if (state && state.hasUserActions()) {
    const rec = buildRecord(state, modelTag);
    saveRecord(rec);
    maybeSubmit(rec);
  }
}

function divide() {
  const text = els.input.value.trim();
  if (!text) return;
  autosave();                       // persist decisions of the previous run
  setStatus('processing…');
  reqId++;
  worker.postMessage({ type: 'analyze', id: reqId, text });
}

worker.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'progress') {
    setStatus(`loading model… ${Math.round(100 * msg.got / msg.total)}%`);
  } else if (msg.type === 'ready') {
    modelTag = msg.modelTag;
    els.threshold.value = String(msg.defaultThreshold);
    els.thresholdVal.textContent = els.threshold.value;
    els.divide.disabled = false;
    setStatus(`ready (${modelTag})`);
  } else if (msg.type === 'analysis') {
    if (msg.id !== reqId) return;
    state = new ReviewState(
      els.input.value.trim(),
      { canonical: msg.canonical, probs: msg.probs, warnings: msg.warnings },
      Number(els.threshold.value),
    );
    attnIndex = -1;
    els.editMode.checked = false;
    showWarnings(msg.warnings);
    rerender();
    els.copyBtn.disabled = els.downloadBtn.disabled = false;
    setStatus(`ready (${modelTag})`);
  } else if (msg.type === 'error') {
    setStatus(`model failed to load: ${msg.message}`);
  }
};

// ---- wiring -------------------------------------------------------------

els.divide.onclick = divide;

function updateCharCount() {
  const n = [...els.input.value].length;
  els.charCount.textContent = n ? `${n.toLocaleString('en-US')} chars` : '';
}
els.input.addEventListener('input', updateCharCount);
updateCharCount();

document.addEventListener('keydown', (e) => {
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key === 'Enter') { e.preventDefault(); divide(); return; }
  if (document.activeElement === els.input || els.editMode.checked) return;
  if (meta && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (!state) return;
    if (e.shiftKey) state.redo(); else state.undo();
    rerender();
    return;
  }
  if (e.key === 'n' || e.key === 'p') {
    if (!state) return;
    const pts = attentionPositions(state, els.showCandidates.checked);
    if (!pts.length) return;
    attnIndex = e.key === 'n'
      ? (attnIndex + 1) % pts.length
      : (attnIndex - 1 + pts.length) % pts.length;
    const pos = pts[attnIndex];
    const el = els.result.querySelector(
      `[data-pos="${pos}"],[data-cand="${pos}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'center' });
    els.result.querySelectorAll('.focus').forEach((x) =>
      x.classList.remove('focus'));
    el?.classList.add('focus');
  }
});

els.threshold.oninput = () => {
  els.thresholdVal.textContent = els.threshold.value;
  if (state) {
    state.setThreshold(Number(els.threshold.value));
    rerender();
  }
};

els.showCandidates.onchange = () => rerender();

els.editMode.onchange = () => {
  if (!state) { els.editMode.checked = false; return; }
  if (els.editMode.checked) {
    els.result.textContent = state.finalText();
  } else {
    state.applyEdit(els.result.textContent ?? '');
  }
  rerender();
};

els.result.addEventListener('blur', () => {
  if (state && els.editMode.checked) {
    state.applyEdit(els.result.textContent ?? '');
  }
});

els.resetBtn.onclick = () => {
  if (!state) return;
  state.reset();
  els.editMode.checked = false;
  rerender();
};

els.copyBtn.onclick = async () => {
  if (!state) return;
  autosave();
  await navigator.clipboard.writeText(state.finalText());
  setStatus('copied ✓');
  setTimeout(() => setStatus(`ready (${modelTag})`), 1500);
};

els.downloadBtn.onclick = () => {
  if (!state) return;
  autosave();
  downloadText(`padaccheda_${stamp()}.txt`, state.finalText(), true);
};

els.exportBtn.onclick = () => {
  autosave();
  const jsonl = exportJsonl();
  if (!jsonl) { setStatus('no corrections to export yet'); return; }
  downloadText(`padaccheda_corrections_${stamp()}.jsonl`, jsonl + '\n');
  setStatus(`exported ${recordCount()} record(s) ✓`);
  setTimeout(() => setStatus(`ready (${modelTag})`), 2000);
};

// ---- data-collection consent (opt-out) ----------------------------------

els.shareData.checked = getShareConsent();
els.shareData.onchange = () => setShareConsent(els.shareData.checked);

function dismissNotice() { markNoticeSeen(); els.notice.hidden = true; }
els.noticeOk.onclick = dismissNotice;
els.noticeOff.onclick = () => {
  setShareConsent(false);
  els.shareData.checked = false;
  dismissNotice();
};
// Show the one-time notice only when collection is actually configured.
if (collectionConfigured() && !noticeSeen()) els.notice.hidden = false;

window.addEventListener('beforeunload', autosave);
