import { useCallback, useEffect, useRef, useState } from 'react';
import { answer, startGame, tick } from '../game/engine';
import type { GameState, Mode } from '../game/types';
import { subscribeVisibility } from '../platform/heybox';

export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [now, setNow] = useState(Date.now());
  const hostVisible = useRef(true);
  const update = useCallback(() => {
    const time = Date.now();
    setNow(time);
    setState(current => current ? tick(current, time, hostVisible.current && !document.hidden) : null);
  }, []);
  useEffect(() => {
    if (!state || state.phase === 'finished') return;
    const timer = window.setInterval(update, 80);
    const visibility = () => update();
    document.addEventListener('visibilitychange', visibility);
    const stop = subscribeVisibility(visible => { hostVisible.current = visible; update(); });
    return () => { clearInterval(timer); stop(); document.removeEventListener('visibilitychange', visibility); };
  }, [Boolean(state && state.phase !== 'finished'), update]);
  const start = useCallback((mode: Mode) => { const time = Date.now(); setNow(time); setState(startGame(mode, time)); }, []);
  const choose = useCallback((id: string) => { const time = Date.now(); setNow(time); setState(current => current ? answer(current, id, time) : null); }, []);
  return { state, now, start, choose, reset: () => setState(null) };
}
