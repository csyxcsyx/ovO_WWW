import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { questions } from '../data/questions';
import { answer, startGame } from '../game/engine';
import { Game } from './Game';
import { Home } from './Home';
import { Review } from './Review';
import { Rules } from './Rules';

describe('challenge wording', () => {
  it('identifies reverse questions in the prompt, resolved feedback and review', () => {
    const question = questions.find(question => question.challenge === 'impostor')!;
    const state = { ...startGame('survival', Date.now()), question, choices: question.choices };
    const html = renderToStaticMarkup(<Game state={state} blocked={false} choose={() => {}} onExit={() => {}} />);
    expect(html).toContain('找冒牌：哪一条没有使用它的官网域名？');
    expect(html).toContain('这次反过来');
    const resolved = answer(state, question.correctId, state.startedAt + 100);
    expect(renderToStaticMarkup(<Game state={resolved} blocked={false} choose={() => {}} onExit={() => {}} />)).toContain('找到了，冒牌项！');
    const review = renderToStaticMarkup(<Review history={resolved.history} />);
    expect(review).toContain('应选的冒牌项');
    expect(review).toContain('使用官网域名');
    expect(review).toContain('本题应选这一项');
  });
  it('does not show question-bank totals on home or rules', () => {
    const home = renderToStaticMarkup(<Home mode="sprint" best={0} onMode={() => {}} onStart={() => {}} onRanking={() => {}} onRecords={() => {}} onRules={() => {}} />);
    expect(home).not.toContain('bank-stats');
    expect(home).not.toContain('个网站');
    const rules = renderToStaticMarkup(<Rules />);
    expect(rules).not.toContain('道题目');
    expect(rules).toContain('找冒牌时');
    expect(rules).toContain('简单、中等和困难题穿插');
  });
});
