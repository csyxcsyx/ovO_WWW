import { useEffect, useState } from 'react';
import { getHandshake, initializeViewport, subscribeHandshake, subscribeUnload } from '../platform/heybox';

export function usePlatform() {
  const [handshake, setHandshake] = useState(getHandshake);
  const [terminated, setTerminated] = useState(false);
  useEffect(() => subscribeHandshake(setHandshake), []);
  useEffect(() => subscribeUnload(() => setTerminated(true)), []);
  useEffect(() => {
    if (handshake.status !== 'ready') return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void initializeViewport().then(cleanup => { if (disposed) cleanup?.(); else stop = cleanup; }).catch(() => {});
    return () => { disposed = true; stop?.(); };
  }, [handshake.status]);
  return { handshake, ready: handshake.status === 'ready' && !terminated };
}
