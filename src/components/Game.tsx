import { ArrowLeft, Check, Heart, Shield, Timer, X, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { AnswerIntent, GameState } from '../game/types';
import { DIFFICULTY_LABEL, MODE_LABEL } from '../game/types';
import { QUESTION_MS, SPRINT_MS } from '../game/engine';
import { GameClock } from './GameClock';

interface Props { state: GameState; choose: (intent: AnswerIntent) => void; onExit: () => void; blocked: boolean }
export function Game({ state, choose, onExit, blocked }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pointerTurn = useRef<string | null>(null);
  const turn = `${state.runId}:${state.questionSequence}`;
  const feedback = state.phase === 'feedback';
  const last = state.history.at(-1);
  const chooseOption = (id: string) => choose({ runId: state.runId, questionSequence: state.questionSequence, choiceId: id });
  useEffect(() => {
    content.current?.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
    pointerTurn.current = null;
  }, [turn]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (blocked || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || state.phase !== 'playing') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName) || (event.target as HTMLElement)?.isContentEditable) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0) { event.preventDefault(); choose({ runId: state.runId, questionSequence: state.questionSequence, choiceId: state.choices[index].id }); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [choose, state, blocked]);
  return <main className="game-page">
    <div className="game-topline"><button className="button-soft" onClick={onExit}><ArrowLeft size={18} aria-hidden="true" />选择模式</button><span className="mode-label">{state.mode === 'sprint' ? <Timer size={16} aria-hidden="true" /> : <Shield size={16} aria-hidden="true" />}{MODE_LABEL[state.mode]}</span></div>
    <div className="game-status">
      <GameClock deadline={state.deadline} limit={state.mode === 'sprint' ? SPRINT_MS : QUESTION_MS} penalty={feedback && !last?.correct && state.mode === 'sprint'} />
      <div className="game-stat-right">{state.mode === 'sprint' ? <><span className="stat-label">得分</span><strong className="game-score">{state.score.toLocaleString()}</strong></> : <><span className="stat-label">剩余机会</span><div className="lives" aria-label={`剩余 ${Math.max(0, 3 - state.mistakes)} 次机会`}>{[0,1,2].map(i => <Heart key={i} size={21} aria-hidden="true" className={i < 3 - state.mistakes ? 'life-full' : 'life-empty'} />)}</div></>}</div>
    </div>
    <div className="game-content" ref={content}>
      <section className="question-area" aria-labelledby="question-name">
        <div className="question-meta"><span>第 {String(state.questionSequence + 1).padStart(2, '0')} 题</span><span className="difficulty"><i className="difficulty-bars" aria-hidden="true"><b /><b className={state.question.difficulty !== 'easy' ? 'active' : ''} /><b className={state.question.difficulty === 'hard' ? 'active' : ''} /></i>{DIFFICULTY_LABEL[state.question.difficulty]}</span></div>
        <div key={`${turn}-question`} className="question-content enter-question"><span className="question-category">{state.question.category}</span><h1 id="question-name" tabIndex={-1} ref={heading}>{state.question.siteName}</h1><p>{state.question.prompt}</p></div>
        <div className="choices" aria-label="网址选项" key={`${turn}-choices`}>
          {state.choices.map((choice, index) => {
            const correct = feedback && choice.id === state.question.correctId;
            const wrong = feedback && choice.id === last?.choiceId && !last.correct;
            return <button className={`choice ${correct ? 'choice-correct' : ''} ${correct && last?.correct ? 'choice-celebrate' : ''} ${wrong ? 'choice-wrong' : ''}`} key={choice.id} disabled={feedback || blocked}
              onPointerDown={() => { pointerTurn.current = turn; }} onPointerCancel={() => { pointerTurn.current = null; }}
              onClick={event => { if (event.detail === 0 || pointerTurn.current === turn) chooseOption(choice.id); pointerTurn.current = null; }}
              aria-label={`选项 ${index + 1}，${choice.url}${correct ? '，正确答案' : wrong ? '，回答错误' : ''}`}>
              <span className="choice-letter" aria-hidden="true">{correct ? <Check size={19} /> : wrong ? <X size={19} /> : String.fromCharCode(65 + index)}</span><code>{choice.url}</code><span className="choice-end" aria-hidden="true">{!feedback && <kbd>{index + 1}</kbd>}</span>
            </button>;
          })}
        </div>
      </section>
    </div>
    <div className="feedback-line" role="status" aria-live="polite">
      {feedback ? <span key={state.history.length} className="answer-feedback">{last?.correct ? <><Check size={18} aria-hidden="true" />认准了！{state.streak > 1 ? ` ${state.streak} 连击` : ''}{state.mode === 'sprint' ? ` +${100 + Math.min(state.streak - 1, 5) * 10}` : ''}</> : <><X size={18} aria-hidden="true" />{last?.choiceId ? '差一点，被迷惑了' : '时间到，错过了'}{state.mode === 'survival' ? ' · 机会 −1' : ''}</>}</span> : state.streak >= 2 ? <span className="combo" key={state.streak}><Zap size={17} aria-hidden="true" />{state.streak} 连击，眼力在线</span> : <span className="game-hint">{state.mode === 'survival' ? `已认出 ${state.correct} 个官网` : '看清网址，选出真正的入口'}</span>}
    </div>
    <div className="game-bottom"><span>网址仅作题目展示，不会打开网站</span><span className="keyboard-tip">按 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 选择</span></div>
  </main>;
}
