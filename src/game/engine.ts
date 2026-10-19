import { questions } from '../data/questions';
import type { AnswerIntent, Difficulty, GameResult, GameState, Mode, Question } from './types';

export const FEEDBACK_MS = 650;
export const SPRINT_MS = 60_000;
export const QUESTION_MS = 12_000;
export const secondsLeft = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));
export type Random = () => number;
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
export function difficultyAt(answered: number): Difficulty {
  return answered < 5 ? 'easy' : answered < 10 ? 'medium' : 'hard';
}
export function pickQuestion(answered: number, asked: string[], recentSites: string[], random: Random = Math.random, pool: Question[] = questions): Question {
  const tier = pool.filter(q => q.difficulty === difficultyAt(answered));
  const unseen = tier.filter(q => !asked.includes(q.id));
  const available = unseen.length ? unseen : tier;
  const unseenSites = available.filter(q => !recentSites.includes(q.siteId));
  const notPrevious = available.filter(q => q.siteId !== recentSites.at(-1));
  const candidates = unseenSites.length ? unseenSites : notPrevious.length ? notPrevious : available;
  if (!candidates.length) throw new Error('题库中缺少当前难度的题目');
  return candidates[Math.floor(random() * candidates.length)];
}
export function startGame(mode: Mode, now: number, random: Random = Math.random, runId = `${mode}-${now}`): GameState {
  const question = pickQuestion(0, [], [], random);
  return { runId, questionSequence: 0, mode, phase: 'playing', question, choices: shuffle(question.choices, random), history: [],
    startedAt: now, questionStartedAt: now, deadline: now + (mode === 'sprint' ? SPRINT_MS : QUESTION_MS),
    feedbackUntil: 0, score: 0, correct: 0, mistakes: 0, streak: 0, maxStreak: 0, recentSites: [question.siteId], asked: [question.id] };
}
export function finishGame(state: GameState, now: number): GameState {
  return { ...state, phase: 'finished', finishedAt: now };
}
export function answer(state: GameState, choiceId: string | null, now: number): GameState {
  if (state.phase !== 'playing') return state;
  if (state.mode === 'sprint' && now >= state.deadline) return tick(state, now, false);
  if (choiceId !== null && !state.choices.some(c => c.id === choiceId)) return state;
  // 到期与点击竞争时，只按一次超时处理。
  if (now >= state.deadline) choiceId = null;
  const correct = choiceId === state.question.correctId;
  const streak = correct ? state.streak + 1 : 0;
  const score = state.mode === 'sprint'
    ? state.score + (correct ? 100 + Math.min(state.streak, 5) * 10 : 0)
    : state.correct + (correct ? 1 : 0);
  const deadline = state.mode === 'sprint' && !correct ? Math.max(now, state.deadline - 3000) : state.deadline;
  const next: GameState = { ...state, phase: 'feedback', feedbackUntil: now + FEEDBACK_MS,
    score, streak, maxStreak: Math.max(state.maxStreak, streak), deadline,
    correct: state.correct + Number(correct), mistakes: state.mistakes + Number(!correct),
    history: [...state.history, { questionId: state.question.id, choiceId, correct, elapsedMs: Math.max(0, Math.min(now, state.deadline) - state.questionStartedAt) }] };
  if (state.mode === 'sprint' && deadline <= now) return finishGame(next, now);
  return next;
}
// A queued input belongs to one particular presentation, even if a question recurs.
export function answerTurn(state: GameState, intent: AnswerIntent, now: number): GameState {
  if (intent.runId !== state.runId || intent.questionSequence !== state.questionSequence) return state;
  return answer(state, intent.choiceId, now);
}
export function tick(state: GameState, now: number, visible: boolean, random: Random = Math.random): GameState {
  if (state.phase === 'finished') return state;
  if (state.mode === 'sprint' && now >= state.deadline) {
    // 正在作答而非反馈时，将未答题记作一次超时，保证结算可回看。
    const withTimeout = state.phase === 'playing' ? { ...state, mistakes: state.mistakes + 1, streak: 0,
      history: [...state.history, { questionId: state.question.id, choiceId: null, correct: false, elapsedMs: Math.max(0, state.deadline - state.questionStartedAt) }] } : state;
    return finishGame(withTimeout, state.deadline);
  }
  if (state.phase === 'playing' && now >= state.deadline) return answer(state, null, now);
  if (state.phase === 'feedback' && now >= state.feedbackUntil && visible) {
    if (state.mode === 'survival' && state.mistakes >= 3) return finishGame(state, now);
    const question = pickQuestion(state.history.length, state.asked, state.recentSites, random);
    return { ...state, phase: 'playing', questionSequence: state.questionSequence + 1, question, choices: shuffle(question.choices, random),
      questionStartedAt: now, deadline: state.mode === 'survival' ? now + QUESTION_MS : state.deadline,
      asked: [...state.asked, question.id], recentSites: [...state.recentSites, question.siteId] };
  }
  return state;
}
export function resultFrom(state: GameState): GameResult {
  if (state.phase !== 'finished') throw new Error('对局尚未结束');
  return { id: state.runId, mode: state.mode, score: state.score,
    correct: state.correct, total: state.history.length, maxStreak: state.maxStreak,
    durationMs: Math.max(0, (state.finishedAt ?? state.deadline) - state.startedAt),
    finishedAt: state.finishedAt ?? state.deadline, history: state.history };
}
