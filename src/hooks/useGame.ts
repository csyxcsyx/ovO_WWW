import { useCallback, useEffect, useRef, useState } from 'react';
import { answerTurn, startGame, tick } from '../game/engine';
import type { AnswerIntent, GameState, Mode } from '../game/types';
import { subscribeVisibility } from '../platform/heybox';

export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const current = useRef<GameState | null>(null);
  const run = useRef(0);
  const hostVisible = useRef(true);
  // Keep the authoritative state synchronous: queued events cannot reuse a turn,
  // and React updater replay cannot run random question selection twice.
  const publish = useCallback((next: GameState | null) => {
    if (next === current.current) return;
    current.current = next;
    setState(next);
  }, []);
  const update = useCallback(() => {
    if (current.current) publish(tick(current.current, Date.now(), hostVisible.current && !document.hidden));
  }, [publish]);
  const active = Boolean(state && state.phase !== 'finished');
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(update, 80);
    document.addEventListener('visibilitychange', update);
    const stop = subscribeVisibility(visible => { hostVisible.current = visible; update(); });
    return () => { clearInterval(timer); stop(); document.removeEventListener('visibilitychange', update); };
  }, [active, update]);
  const start = useCallback((mode: Mode) => {
    const time = Date.now();
    publish(startGame(mode, time, Math.random, `${mode}-${time}-${++run.current}`));
  }, [publish]);
  const choose = useCallback((intent: AnswerIntent) => {
    if (current.current && hostVisible.current && !document.hidden) publish(answerTurn(current.current, intent, Date.now()));
  }, [publish]);
  const reset = useCallback(() => publish(null), [publish]);
  return { state, start, choose, reset };
}
