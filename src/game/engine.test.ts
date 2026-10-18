import { describe, expect, it } from 'vitest';
import { answer, difficultyAt, FEEDBACK_MS, pickQuestion, resultFrom, shuffle, startGame, tick } from './engine';
import { questions } from '../data/questions';
import type { GameState } from './types';

const random = () => .3;
const advance = (state: GameState, correct = true) => {
  const time = state.questionStartedAt + 200;
  const choice = correct ? state.question.correctId : state.choices.find(c => c.id !== state.question.correctId)!.id;
  const feedback = answer(state, choice, time);
  return tick(feedback, time + FEEDBACK_MS, true, random);
};
describe('deadline-based game', () => {
  it('uses independent mode deadlines', () => {
    expect(startGame('sprint', 100).deadline).toBe(60100);
    expect(startGame('survival', 100).deadline).toBe(12100);
  });
  it('scores by stable IDs even when options move', () => {
    const state = startGame('sprint', 0, random);
    state.choices = [...state.choices].reverse();
    const result = answer(state, state.question.correctId, 500);
    expect(result.correct).toBe(1); expect(result.score).toBe(100);
  });
  it('caps combo bonus and resets on a mistake', () => {
    let state = startGame('sprint', 0, random);
    for (let i=0; i<7; i++) state = advance(state);
    expect(state.score).toBe(900); expect(state.maxStreak).toBe(7);
    state = advance(state, false);
    expect(state.streak).toBe(0); expect(state.maxStreak).toBe(7);
    const next = advance(state); expect(next.score).toBe(1000);
  });
  it('ignores double submissions, invalid IDs and stale choice IDs', () => {
    const state = startGame('sprint', 0, random);
    expect(answer(state, 'invalid', 200)).toBe(state);
    const once = answer(state, state.question.correctId, 200);
    expect(answer(once, state.question.correctId, 201)).toBe(once);
    const next = tick(once, 850, true, random);
    expect(answer(next, state.question.correctId, 860)).toBe(next);
  });
  it('deducts 3 seconds and ends immediately if penalty reaches zero', () => {
    const state = startGame('sprint', 0, random);
    const wrong = state.choices.find(c => c.id !== state.question.correctId)!.id;
    expect(answer(state, wrong, 1000).deadline).toBe(57000);
    const end = answer(state, wrong, 59000);
    expect(end.phase).toBe('finished'); expect(end.history).toHaveLength(1);
  });
  it('an exact-deadline click cannot score or count twice', () => {
    const state = startGame('sprint', 0, random);
    const end = answer(state, state.question.correctId, 60000);
    expect(end.phase).toBe('finished'); expect(end.correct).toBe(0); expect(end.history).toHaveLength(1);
    expect(tick(end, 70000, true)).toBe(end);
  });
  it('expires on return from the background with the original deadline', () => {
    const state = startGame('sprint', 0, random);
    const end = tick(state, 90000, false);
    expect(end.finishedAt).toBe(60000); expect(end.history[0].choiceId).toBeNull();
  });
  it('does not add a second unanswered record during final feedback', () => {
    const state = startGame('sprint', 0, random);
    const feedback = answer(state, state.question.correctId, 59900);
    const end = tick(feedback, 60000, true);
    expect(end.history).toHaveLength(1); expect(end.correct).toBe(1);
  });
  it('ends survival after exactly three timeouts', () => {
    let state = startGame('survival', 1000, random);
    for (let i=1; i<=3; i++) {
      const time = state.deadline;
      state = tick(state, time, true, random);
      expect(state.mistakes).toBe(i);
      expect(state.phase).toBe('feedback');
      state = tick(state, time + FEEDBACK_MS, true, random);
    }
    expect(state.phase).toBe('finished'); expect(state.history).toHaveLength(3);
    expect(resultFrom(state).total).toBe(3);
  });
  it('settles only the current survival question while hidden', () => {
    let state = startGame('survival', 0, random);
    state = tick(state, 50000, false, random);
    state = tick(state, 90000, false, random);
    expect(state.mistakes).toBe(1); expect(state.history).toHaveLength(1);
    state = tick(state, 91000, true, random);
    expect(state.phase).toBe('playing'); expect(state.deadline).toBe(103000);
  });
  it('resolves survival timeout versus click once and ranks by correct count', () => {
    let state = startGame('survival', 0, random);
    state = advance(state);
    expect(state.score).toBe(1);
    const feedback = answer(state, state.question.correctId, state.deadline);
    expect(feedback.score).toBe(1); expect(feedback.mistakes).toBe(1);
    expect(answer(feedback, state.question.correctId, state.deadline)).toBe(feedback);
  });
});
describe('question selection', () => {
  it('progresses difficulty at 5 and 10 answers', () => {
    expect([0,4,5,9,10,99].map(difficultyAt)).toEqual(['easy','easy','medium','medium','hard','hard']);
    let state = startGame('sprint', 0, random);
    for (let i=0;i<5;i++) state = advance(state);
    expect(state.question.difficulty).toBe('medium');
    for (let i=0;i<5;i++) state = advance(state);
    expect(state.question.difficulty).toBe('hard');
  });
  it('avoids used questions and sites, reshuffles an exhausted tier', () => {
    const pool = questions.filter(q => q.difficulty === 'easy').slice(0,3);
    const first = pickQuestion(0, [], [], () => 0, pool);
    const next = pickQuestion(0, [first.id], [first.siteId], () => 0, pool);
    expect(next.siteId).not.toBe(first.siteId);
    const recycled = pickQuestion(0, pool.map(q=>q.id), pool.map(q=>q.siteId), () => 0, pool);
    expect(recycled.siteId).not.toBe(pool.at(-1)!.siteId);
  });
  it('shuffle preserves options without mutating the input', () => {
    const items = [1,2,3]; expect(shuffle(items, () => 0).sort()).toEqual(items); expect(items).toEqual([1,2,3]);
  });
});
