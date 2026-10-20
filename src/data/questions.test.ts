import { describe, expect, it } from 'vitest';
import { questions, sites } from './questions';

describe('question variety without format shortcuts', () => {
  it('includes official and non-official hosts behind @ within the same reverse question', () => {
    const candidates = questions.filter(question => question.variantId === 'before-at');
    expect(candidates.length).toBe(sites.length);
    for (const question of candidates) {
      const site = sites.find(site => site.id === question.siteId)!;
      expect(question.choices.every(choice => choice.url.includes('@'))).toBe(true);
      expect(question.choices.filter(choice => site.acceptedHosts.includes(new URL(choice.url).hostname))).toHaveLength(2);
      expect(site.acceptedHosts.includes(new URL(question.choices.find(choice => choice.id === question.correctId)!.url).hostname)).toBe(false);
    }
  });
  it('varies the correct URL appearance while keeping warm-up eye tests simple', () => {
    const mixed = questions.filter(question => question.challenge === 'mixed');
    expect(mixed.some(question => new URL(question.choices.find(choice => choice.id === question.correctId)!.url).username)).toBe(true);
    for (const question of questions.filter(question => question.difficulty === 'easy')) {
      expect(question.choices.every(choice => !new URL(choice.url).username)).toBe(true);
    }
  });
});
