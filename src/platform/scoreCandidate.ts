import type { GameResult, Mode } from '../game/types';

export interface ScoreCandidate {
  id: string; mode: Mode; score: number;
  correct?: number; total?: number; maxStreak?: number;
}
export function scoreCandidate(result: GameResult): ScoreCandidate {
  const { id, mode, score, correct, total, maxStreak } = result;
  return { id, mode, score, correct, total, maxStreak };
}
export function parseCandidate(value: unknown): ScoreCandidate | undefined {
  if (!value || typeof value !== 'object') return;
  const item = value as ScoreCandidate;
  if (typeof item.id !== 'string' || !item.id || item.id.length > 200 || !['sprint', 'survival'].includes(item.mode)
    || !Number.isSafeInteger(item.score) || item.score <= 0) return;
  const result: ScoreCandidate = { id: item.id, mode: item.mode, score: item.score };
  if ([item.correct, item.total, item.maxStreak].every(n => Number.isSafeInteger(n) && n! >= 0)
    && item.correct! <= item.total! && item.maxStreak! <= item.correct!) {
    result.correct = item.correct; result.total = item.total; result.maxStreak = item.maxStreak;
  }
  return result;
}
