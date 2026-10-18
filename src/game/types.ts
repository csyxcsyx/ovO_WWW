export type Mode = 'sprint' | 'survival';
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface Site {
  id: string; name: string; category: string; url: string; domestic: boolean;
  acceptedHosts: string[]; verifiedAt: string;
  source: { url: string; title: string; status: number; finalUrl: string; checkedAt: string };
}
export interface Choice { id: string; url: string; explanation: string }
export interface Question {
  id: string; siteId: string; siteName: string; category: string;
  difficulty: Difficulty; kind: 'spelling' | 'hierarchy' | 'authority' | 'path' | 'syntax';
  prompt: string; choices: Choice[]; correctId: string; insight: string; source: Site['source'];
}
export interface AnswerRecord {
  questionId: string; choiceId: string | null; correct: boolean; elapsedMs: number;
}
export interface GameState {
  mode: Mode; phase: 'playing' | 'feedback' | 'finished';
  question: Question; choices: Choice[]; history: AnswerRecord[];
  startedAt: number; questionStartedAt: number; deadline: number; feedbackUntil: number;
  finishedAt?: number; score: number; correct: number; mistakes: number;
  streak: number; maxStreak: number; recentSites: string[]; asked: string[];
}
export interface GameResult {
  id: string; mode: Mode; score: number; correct: number; total: number;
  maxStreak: number; durationMs: number; finishedAt: number; history: AnswerRecord[];
}
export const MODE_LABEL: Record<Mode, string> = { sprint: '限时竞速', survival: '生存挑战' };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '入门', medium: '进阶', hard: '高手' };
