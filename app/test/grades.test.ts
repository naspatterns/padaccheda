import { describe, expect, it } from 'vitest';

import { gradeOf, isCandidate } from '../src/grades.js';

describe('grades', () => {
  it('boundaries', () => {
    expect(gradeOf(0.95)).toBe('high');
    expect(gradeOf(0.9)).toBe('high');
    expect(gradeOf(0.899)).toBe('mid');
    expect(gradeOf(0.6)).toBe('mid');
    expect(gradeOf(0.59)).toBe('low');
    expect(gradeOf(0.32)).toBe('low');
  });

  it('candidates sit in the near-miss band below threshold', () => {
    expect(isCandidate(0.31, 0.32)).toBe(true);
    expect(isCandidate(0.18, 0.32)).toBe(true);
    expect(isCandidate(0.16, 0.32)).toBe(false);   // below t-0.15
    expect(isCandidate(0.33, 0.32)).toBe(false);   // above threshold
    expect(isCandidate(0.04, 0.1)).toBe(false);    // below floor
  });
});
