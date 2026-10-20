import { describe, expect, it } from 'vitest';
import { questions } from '../data/questions';
import { difficultyQuota, drawQuestion, emptyDraw } from './draw';
import type { Question } from './types';

const seeded = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function sequence(seed: number, count = 100, pool = questions) {
  const random = seeded(seed);
  let draw = emptyDraw();
  const result: Question[] = [];
  for (let i = 0; i < count; i++) {
    const next = drawQuestion(i, result.map(question => question.id), draw, random, pool);
    result.push(next.question); draw = next.draw;
  }
  return result;
}
const counts = (items: Question[]) => Object.fromEntries(['easy', 'medium', 'hard'].map(difficulty => [difficulty, items.filter(question => question.difficulty === difficulty).length]));

describe('mixed challenge pacing', () => {
  it('keeps exact difficulty budgets, variety and website cooldowns for 100 seeds × 100 turns', () => {
    let syntaxCount = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const items = sequence(seed);
      syntaxCount += items.filter(question => question.challenge === 'syntax').length;
      expect(counts(items.slice(0, 5)), `warm-up seed ${seed}`).toEqual(difficultyQuota(0));
      expect(counts(items.slice(5, 10))).toEqual(difficultyQuota(5));
      for (let start = 10; start + 20 <= items.length; start += 20) {
        expect(counts(items.slice(start, start + 20))).toEqual(difficultyQuota(start));
      }
      expect(items.slice(0, 2).every(question => question.objective === 'official')).toBe(true);
      expect(items.slice(0, 10).every(question => question.challenge !== 'syntax')).toBe(true);
      expect(new Set(items.map(question => question.id)).size).toBe(items.length);
      for (let i = 0; i < items.length; i++) {
        const question = items[i];
        const recent = items.slice(Math.max(0, i - 8), i);
        expect(recent.some(previous => previous.siteId === question.siteId), `site cooldown seed ${seed} turn ${i}`).toBe(false);
        if (i >= 1) {
          expect(question.challenge).not.toBe(items[i - 1].challenge);
          expect(question.primaryMechanism).not.toBe(items[i - 1].primaryMechanism);
        }
        if (i >= 2) {
          expect(items.slice(i - 2, i + 1).every(previous => previous.difficulty === 'hard')).toBe(false);
          expect(items.slice(i - 2, i + 1).every(previous => previous.category === question.category)).toBe(false);
        }
        if (i >= 4) expect(new Set(items.slice(i - 4, i + 1).map(previous => previous.challenge)).size, `challenge variety seed ${seed} turn ${i}`).toBeGreaterThanOrEqual(3);
        if (i >= 19) expect(items.slice(i - 19, i + 1).filter(previous => previous.challenge === 'syntax').length).toBeLessThanOrEqual(1);
      }
      const categories = [...new Set(items.map(question => question.category))];
      expect(categories.length).toBe(9);
      const categoryCounts = categories.map(category => items.filter(question => question.category === category).length);
      expect(Math.max(...categoryCounts) - Math.min(...categoryCounts)).toBeLessThanOrEqual(4);
      for (const type of ['classic', 'impostor', 'spot-difference', 'mixed']) {
        expect(items.slice(10).filter(question => question.challenge === type).length).toBeGreaterThanOrEqual(10);
      }
    }
    expect(syntaxCount).toBeGreaterThan(0);
  }, 30000);
  it('is deterministic and never mutates the previous run state', () => {
    expect(sequence(17).map(question => question.id)).toEqual(sequence(17).map(question => question.id));
    const draw = emptyDraw();
    const before = JSON.stringify(draw);
    drawQuestion(0, [], draw, seeded(3));
    expect(JSON.stringify(draw)).toBe(before);
  });
  it('uses every eligible question before recycling and terminates on incomplete pools', () => {
    const pool = questions.filter(question => question.challenge === 'classic' && question.difficulty === 'easy').slice(0, 3);
    const items = sequence(7, 30, pool);
    expect(new Set(items.slice(0, 3).map(question => question.id)).size).toBe(3);
    expect(items.every((question, index) => !index || question.siteId !== items[index - 1].siteId)).toBe(true);
    const single = sequence(7, 30, [pool[0]]);
    expect(single).toHaveLength(30);
    expect(() => drawQuestion(0, [], emptyDraw(), seeded(1), [])).toThrow('题库为空');
  });
});
