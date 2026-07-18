/** Review-session state: engine analysis + user decisions, with undo/redo.
 *
 * Positions are canonical (NFC) char indices; a cut at pos means a space
 * before canonical[pos]. Engine cuts come from decide(analysis, threshold);
 * user overrides are kept separately so threshold changes keep user intent.
 */
import { decide } from '@engine';
import type { Analysis, SplitResult } from '@engine';

export type Override = 'reject' | 'add';

export interface Snapshot {
  overrides: [number, Override][];
  editedText: string | null;
}

export interface FinalSpan {
  pos: number;
  prob: number;
  kind: 'engine' | 'added';
  rejected: boolean;
}

export class ReviewState {
  readonly input: string;
  readonly analysis: Analysis;
  threshold: number;
  overrides = new Map<number, Override>();
  editedText: string | null = null;
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  constructor(input: string, analysis: Analysis, threshold: number) {
    this.input = input;
    this.analysis = analysis;
    this.threshold = threshold;
  }

  engineResult(): SplitResult {
    return decide(this.analysis, this.threshold);
  }

  /** All juncture marks to render: engine cuts (with rejected flag) + adds. */
  spans(): FinalSpan[] {
    const res = this.engineResult();
    const out: FinalSpan[] = res.spans.map((s) => ({
      pos: s.pos,
      prob: s.prob,
      kind: 'engine' as const,
      rejected: this.overrides.get(s.pos) === 'reject',
    }));
    const enginePos = new Set(res.spans.map((s) => s.pos));
    for (const [pos, ov] of this.overrides) {
      if (ov === 'add' && !enginePos.has(pos)) {
        out.push({
          pos,
          prob: this.analysis.probs[pos] ?? 0,
          kind: 'added',
          rejected: false,
        });
      }
    }
    return out.sort((a, b) => a.pos - b.pos);
  }

  /** Final text with user decisions applied (or the free-edited text). */
  finalText(): string {
    if (this.editedText !== null) return this.editedText;
    const cuts = new Set(
      this.spans().filter((s) => !s.rejected).map((s) => s.pos));
    const chars = [...this.analysis.canonical];
    const parts: string[] = [];
    for (let i = 0; i < chars.length; i++) {
      if (cuts.has(i)) parts.push(' ');
      parts.push(chars[i]);
    }
    return parts.join('');
  }

  hasUserActions(): boolean {
    return this.overrides.size > 0 || this.editedText !== null;
  }

  // ---- mutations (all snapshot for undo) --------------------------------

  private push() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
  }

  private snapshot(): Snapshot {
    return { overrides: [...this.overrides], editedText: this.editedText };
  }

  private restore(s: Snapshot) {
    this.overrides = new Map(s.overrides);
    this.editedText = s.editedText;
  }

  /** Click an engine cut: accept <-> reject. Click an added cut: remove it. */
  toggle(pos: number) {
    this.push();
    const cur = this.overrides.get(pos);
    if (cur === 'reject') this.overrides.delete(pos);
    else if (cur === 'add') this.overrides.delete(pos);
    else this.overrides.set(pos, 'reject');
  }

  /** Click a candidate marker: insert a user space there. */
  addAt(pos: number) {
    this.push();
    this.overrides.set(pos, 'add');
  }

  setThreshold(t: number) {
    this.threshold = t;
  }

  applyEdit(text: string) {
    this.push();
    this.editedText = text;
  }

  exitEditKeepText(text: string) {
    // remain in the edited-text world; structured toggles are frozen after edit
    this.push();
    this.editedText = text;
  }

  reset() {
    this.push();
    this.overrides.clear();
    this.editedText = null;
  }

  undo(): boolean {
    const s = this.undoStack.pop();
    if (!s) return false;
    this.redoStack.push(this.snapshot());
    this.restore(s);
    return true;
  }

  redo(): boolean {
    const s = this.redoStack.pop();
    if (!s) return false;
    this.undoStack.push(this.snapshot());
    this.restore(s);
    return true;
  }
}
