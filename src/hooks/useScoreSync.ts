import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { ScoreSync } from '../platform/scoreSync';
import { submitResult, subscribeLogin, subscribeVisibility, subscribeUnload } from '../platform/heybox';

export function useScoreSync(ready: boolean) {
  const service = useMemo(() => new ScoreSync(submitResult), []);
  const states = useSyncExternalStore(service.subscribe, service.getSnapshot);
  useEffect(() => { service.setReady(ready); return () => service.setReady(false); }, [ready, service]);
  useEffect(() => subscribeLogin(() => service.resetSession()), [service]);
  useEffect(() => subscribeVisibility(visible => { if (visible) service.foreground(); }), [service]);
  useEffect(() => subscribeUnload(() => { service.setReady(false); service.resetSession(); }), [service]);
  const enqueue = useCallback((result: Parameters<ScoreSync['enqueue']>[0]) => service.enqueue(result), [service]);
  const retry = useCallback((mode: Parameters<ScoreSync['retry']>[0]) => service.retry(mode), [service]);
  return { states, enqueue, retry };
}
