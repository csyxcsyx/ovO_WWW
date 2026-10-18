import { ArrowLeft, Check, Heart, Shield, Timer, X, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { GameState } from '../game/types';
import { DIFFICULTY_LABEL, MODE_LABEL } from '../game/types';
import { QUESTION_MS, SPRINT_MS } from '../game/engine';

interface Props { state: GameState; now: number; choose: (id: string) => void; onExit: () => void; blocked: boolean }
export function Game({ state, now, choose, onExit, blocked }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = state.phase === 'feedback';
  const last = state.history.at(-1);
  const remaining = Math.max(0, state.deadline - now);
  const limit = state.mode === 'sprint' ? SPRINT_MS : QUESTION_MS;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [state.question.id]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (blocked || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || state.phase !== 'playing') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName) || (event.target as HTMLElement)?.isContentEditable) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0) { event.preventDefault(); choose(state.choices[index].id); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [choose, state.choices, state.phase, blocked]);
  return <main className="game-page enter">
    <div className="game-topline"><button className="button-quiet" onClick={onExit}><ArrowLeft size={18} aria-hidden="true" />退出本局</button><span className="mode-label">{state.mode === 'sprint' ? <Timer size={16} aria-hidden="true" /> : <Shield size={16} aria-hidden="true" />}{MODE_LABEL[state.mode]}</span></div>
    <div className="game-status">
      <div className={`timer-display ${remaining < 6000 ? 'timer-urgent' : ''}`} role="timer" aria-label={`剩余 ${Math.ceil(remaining / 1000)} 秒`} aria-live="off"><span className="timer-number">{Math.ceil(remaining / 1000).toString().padStart(2, '0')}</span><span>秒</span></div>
      <div className="game-stat-right">{state.mode === 'sprint' ? <><span className="stat-label">当前得分</span><strong className="game-score">{state.score.toLocaleString()}</strong></> : <><span className="stat-label">剩余机会</span><div className="lives" aria-label={`剩余 ${Math.max(0, 3 - state.mistakes)} 次机会`}>{[0,1,2].map(i => <Heart key={i} size={22} aria-hidden="true" className={i < 3 - state.mistakes ? 'life-full' : 'life-empty'} />)}</div></>}</div>
    </div>
    <div className="time-track" aria-hidden="true"><div style={{ transform: `scaleX(${Math.min(1, remaining / limit)})` }} /></div>
    <section className="question-area" aria-labelledby="question-name">
      <div className="question-meta"><span>第 {String(state.history.length + (feedback ? 0 : 1)).padStart(2, '0')} 题</span><span className="difficulty"><i className="difficulty-bars" aria-hidden="true"><b /><b className={state.question.difficulty !== 'easy' ? 'active' : ''} /><b className={state.question.difficulty === 'hard' ? 'active' : ''} /></i>{DIFFICULTY_LABEL[state.question.difficulty]}</span></div>
      <div key={state.question.id} className="question-content enter-question"><span className="question-category">{state.question.category}</span><h1 id="question-name" tabIndex={-1} ref={heading}>{state.question.siteName}</h1><p>{state.question.prompt}</p></div>
      <div className="choices" aria-label="网址选项" key={`${state.question.id}-choices`}>
        {state.choices.map((choice, index) => {
          const correct = feedback && choice.id === state.question.correctId;
          const wrong = feedback && choice.id === last?.choiceId && !last.correct;
          return <button className={`choice ${correct ? 'choice-correct' : ''} ${wrong ? 'choice-wrong' : ''}`} key={choice.id} disabled={feedback} onClick={() => choose(choice.id)} aria-label={`选项 ${index + 1}，${choice.url}${correct ? '，正确答案' : wrong ? '，回答错误' : ''}`}>
            <span className="choice-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><code>{choice.url}</code><span className="choice-end" aria-hidden="true">{correct ? <Check size={21} /> : wrong ? <X size={21} /> : <kbd>{index + 1}</kbd>}</span>
          </button>;
        })}
      </div>
      <div className="feedback-line" role="status" aria-live="polite">
        {feedback ? <span key={state.history.length} className="answer-feedback">{last?.correct ? <><Check size={18} aria-hidden="true" />认准了！{state.streak > 1 ? ` ${state.streak} 连击` : ''}{state.mode === 'sprint' ? ` +${100 + Math.min(state.streak - 1, 5) * 10}` : ''}</> : <><X size={18} aria-hidden="true" />{last?.choiceId ? '差一点，被迷惑了' : '时间到，错过了'}{state.mode === 'sprint' ? ' −3秒' : ' · 机会 −1'}</>}</span> : state.streak >= 2 ? <span className="combo" key={state.streak}><Zap size={17} aria-hidden="true" />{state.streak} 连击，眼力在线</span> : <span className="game-hint">{state.mode === 'survival' ? `已认出 ${state.correct} 个官网` : '看清每一个字母，再做决定'}</span>}
      </div>
    </section>
    <div className="game-bottom"><span>网址仅作题目展示，不会打开网站</span><span className="keyboard-tip">按 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 选择</span></div>
  </main>;
}
