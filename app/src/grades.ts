/** Confidence grading for inserted spaces (UI-side; engine stays agnostic). */

export type Grade = 'high' | 'mid' | 'low';

export const HIGH_MIN = 0.9;
export const MID_MIN = 0.6;
export const CANDIDATE_BAND = 0.15;   // near-miss band below threshold
export const CANDIDATE_FLOOR = 0.05;

export function gradeOf(prob: number): Grade {
  if (prob >= HIGH_MIN) return 'high';
  if (prob >= MID_MIN) return 'mid';
  return 'low';
}

export function isCandidate(prob: number, threshold: number): boolean {
  return prob < threshold &&
    prob >= Math.max(CANDIDATE_FLOOR, threshold - CANDIDATE_BAND);
}

export const GRADE_LABELS: Record<Grade, string> = {
  high: 'high confidence (≥ 0.90)',
  mid: 'medium (0.60–0.90)',
  low: 'low — please review',
};
