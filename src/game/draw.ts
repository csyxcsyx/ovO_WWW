import { questions } from '../data/questions';
import type { Challenge, Difficulty, DrawnQuestion, DrawState, Question } from './types';

type Random = () => number;
const sample = <T,>(items: T[], random: Random): T => items[Math.floor(random() * items.length)];
export const emptyDraw = (): DrawState => ({ remaining: [], recent: [],
  challenges: { classic: 0, impostor: 0, 'spot-difference': 0, mixed: 0, syntax: 0 }, categories: {} });
export const difficultyQuota = (answered: number): Record<Difficulty, number> => answered < 5
  ? { easy: 3, medium: 2, hard: 0 } : answered < 10
    ? { easy: 1, medium: 3, hard: 1 } : { easy: 5, medium: 8, hard: 7 };
function hardRun(recent: DrawnQuestion[]) {
  let count = 0;
  for (let i = recent.length - 1; i >= 0 && recent[i].difficulty === 'hard'; i--) count++;
  return count;
}
function canFinish(bag: Difficulty[], streak: number) {
  const hard = bag.filter(value => value === 'hard').length;
  return hard <= 2 * (bag.length - hard + 1) - streak;
}
function withoutOne(bag: Difficulty[], difficulty: Difficulty) {
  const next = [...bag];
  const index = next.indexOf(difficulty);
  if (index >= 0) next.splice(index, 1);
  return next;
}
function makeBag(answered: number, recent: DrawnQuestion[], random: Random) {
  let available = Object.entries(difficultyQuota(answered)).flatMap(([difficulty, count]) => Array<Difficulty>(count).fill(difficulty as Difficulty));
  const bag: Difficulty[] = [];
  let streak = hardRun(recent);
  while (available.length) {
    const feasible = available.filter(difficulty => {
      const nextStreak = difficulty === 'hard' ? streak + 1 : 0;
      return nextStreak <= 2 && canFinish(withoutOne(available, difficulty), nextStreak);
    });
    const difficulty = sample(feasible, random);
    bag.push(difficulty); available = withoutOne(available, difficulty);
    streak = difficulty === 'hard' ? streak + 1 : 0;
  }
  return bag;
}
function diverse(question: Question, recent: DrawnQuestion[]) {
  if (recent.length < 4) return true;
  return new Set([...recent.slice(-4).map(item => item.challenge), question.challenge]).size >= 3;
}
function matches(question: Question, recent: DrawnQuestion[], relaxation: number) {
  const previous = recent.at(-1);
  if (!previous) return true;
  if (relaxation < 5 && question.siteId === previous.siteId) return false;
  if (relaxation < 2 && recent.slice(-8).some(item => item.siteId === question.siteId)) return false;
  if (relaxation < 1 && recent.length >= 2 && recent.slice(-2).every(item => item.category === question.category)) return false;
  if (relaxation < 3 && (question.primaryMechanism === previous.primaryMechanism || question.challenge === previous.challenge)) return false;
  if (relaxation < 4 && !diverse(question, recent)) return false;
  return true;
}
function balanced(candidates: Question[], draw: DrawState, random: Random, syntax: boolean) {
  const types = [...new Set(candidates.map(question => question.challenge))];
  const count = Math.min(...types.map(type => draw.challenges[type]));
  const challenge: Challenge = syntax && types.includes('syntax') ? 'syntax'
    : sample(types.filter(type => draw.challenges[type] === count), random);
  const typed = candidates.filter(question => question.challenge === challenge);
  const categories = [...new Set(typed.map(question => question.category))];
  const categoryCount = Math.min(...categories.map(category => draw.categories[category] ?? 0));
  const category = sample(categories.filter(value => (draw.categories[value] ?? 0) === categoryCount), random);
  const categorized = typed.filter(question => question.category === category);
  const site = sample([...new Set(categorized.map(question => question.siteId))], random);
  return sample(categorized.filter(question => question.siteId === site), random);
}

// All choices are made once outside React updater replay. State is immutable;
// difficulty bags, recent variety and usage counts belong only to this run.
export function drawQuestion(answered: number, asked: string[], draw: DrawState, random: Random = Math.random, pool: Question[] = questions): { question: Question; draw: DrawState } {
  if (!pool.length) throw new Error('题库为空，无法开始鉴定');
  const bag = draw.remaining.length ? draw.remaining : makeBag(answered, draw.recent, random);
  const syntax = answered >= 10 && !draw.recent.slice(-19).some(question => question.challenge === 'syntax') && random() < .05;
  let eligible = pool.filter(question => (answered >= 2 || question.objective === 'official') && (question.challenge !== 'syntax' || syntax));
  // A tiny/custom pool must still terminate even if it cannot meet warm-up rules.
  if (!eligible.length) eligible = pool;
  const used = new Set(asked);
  const unseen = eligible.filter(question => !used.has(question.id));
  if (unseen.length) eligible = unseen;
  const streak = hardRun(draw.recent);
  const feasibleDifficulties = [...new Set(bag)].filter(difficulty => {
    const nextStreak = difficulty === 'hard' ? streak + 1 : 0;
    return nextStreak <= 2 && canFinish(withoutOne(bag, difficulty), nextStreak);
  });
  let chosen: Question | undefined;
  for (let relaxation = 0; relaxation <= 5 && !chosen; relaxation++) {
    for (const difficulty of feasibleDifficulties) {
      const candidates = eligible.filter(question => question.difficulty === difficulty && matches(question, draw.recent, relaxation));
      if (candidates.length) { chosen = balanced(candidates, draw, random, syntax); break; }
    }
  }
  // Only incomplete/exhausted custom pools reach this fallback. Prefer changing
  // site and an unseen question over reusing a previous question to fill a quota.
  if (!chosen) {
    const different = eligible.filter(question => question.siteId !== draw.recent.at(-1)?.siteId);
    chosen = balanced(different.length ? different : eligible, draw, random, syntax);
  }
  const remaining = bag.includes(chosen.difficulty) ? withoutOne(bag, chosen.difficulty) : bag.slice(1);
  const { id, siteId, category, challenge, primaryMechanism, difficulty } = chosen;
  return { question: chosen, draw: { remaining,
    recent: [...draw.recent, { id, siteId, category, challenge, primaryMechanism, difficulty }].slice(-20),
    challenges: { ...draw.challenges, [challenge]: draw.challenges[challenge] + 1 },
    categories: { ...draw.categories, [category]: (draw.categories[category] ?? 0) + 1 } } };
}
