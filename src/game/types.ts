export type Mode = 'sprint' | 'survival';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Challenge = 'classic' | 'impostor' | 'spot-difference' | 'mixed' | 'syntax';
export type Objective = 'official' | 'impostor' | 'syntax';
export type Mechanism = 'brand' | 'omission' | 'insertion' | 'transposition' | 'substitution' | 'hierarchy' | 'userinfo' | 'path' | 'query' | 'syntax';
export interface Site {
  id: string; name: string; category: string; url: string; domestic: boolean;
  acceptedHosts: string[]; verifiedAt: string;
  source: { url: string; title: string; status: number; finalUrl: string; checkedAt: string };
}
export interface Choice { id: string; url: string; explanation: string }
export interface Question {
  id: string; siteId: string; siteName: string; category: string;
  difficulty: Difficulty; challenge: Challenge; objective: Objective;
  variantId: string; primaryMechanism: Mechanism; mechanisms: Mechanism[];
  prompt: string; choices: Choice[]; correctId: string; insight: string; source: Site['source'];
}
export interface AnswerRecord {
  questionId: string; choiceId: string | null; correct: boolean; elapsedMs: number;
}
export type DrawnQuestion = Pick<Question, 'id' | 'siteId' | 'category' | 'challenge' | 'primaryMechanism' | 'difficulty'>;
export interface DrawState {
  remaining: Difficulty[]; recent: DrawnQuestion[];
  challenges: Record<Challenge, number>; categories: Record<string, number>;
}
export interface GameState {
  runId: string; questionSequence: number;
  mode: Mode; phase: 'playing' | 'feedback' | 'finished';
  question: Question; choices: Choice[]; history: AnswerRecord[];
  startedAt: number; questionStartedAt: number; deadline: number; feedbackUntil: number;
  finishedAt?: number; score: number; correct: number; mistakes: number;
  streak: number; maxStreak: number; recentSites: string[]; asked: string[];
  draw: DrawState;
}
export interface AnswerIntent { runId: string; questionSequence: number; choiceId: string }
export interface GameResult {
  id: string; mode: Mode; score: number; correct: number; total: number;
  maxStreak: number; durationMs: number; finishedAt: number; history: AnswerRecord[];
}
export const MODE_LABEL: Record<Mode, string> = { sprint: '限时竞速', survival: '生存挑战' };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '入门', medium: '进阶', hard: '高手' };
export const CHALLENGE_LABEL: Record<Challenge, string> = { classic: '找正版', impostor: '找冒牌', 'spot-difference': '一字之差', mixed: '混合迷惑', syntax: '只看格式' };
export const answerLabel = (objective: Objective) => objective === 'impostor' ? '应选的冒牌项' : objective === 'syntax' ? '规范写法' : '官网域名';
