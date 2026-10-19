import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ScoreSync } from '../platform/scoreSync';
import { SyncOutbox } from '../platform/syncOutbox';
import { getCurrentPlayer, getIdentityRevision, submitResult, subscribeLogin, subscribeVisibility, subscribeUnload } from '../platform/heybox';
import { syncPlayerProfile } from '../platform/profiles';
import type { CurrentPlayer } from '../platform/playerProfile';
import type { ScoreCandidate } from '../platform/scoreCandidate';
import { friendlyError } from '../platform/errors';

export function useScoreSync(ready: boolean) {
  const owner = useRef<string | undefined>(undefined);
  const [account, setAccount] = useState<CurrentPlayer>();
  const [storageError, setStorageError] = useState('');
  const [profileError, setProfileError] = useState('');
  const outbox = useMemo(() => new SyncOutbox({
    getItem: key => { try { return localStorage.getItem(key); } catch { return null; } },
    setItem: (key, value) => localStorage.setItem(key, value),
  }), []);
  const service = useMemo(() => new ScoreSync(
    result => submitResult(result, owner.current),
    pending => {
      if (!owner.current) return;
      try { outbox.save(owner.current, pending); setStorageError(''); }
      catch { setStorageError('待同步成绩暂未持久保存，请在关闭前重试同步。'); }
    },
  ), [outbox]);
  const states = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const refreshAccount = useCallback(async () => {
    const revision = getIdentityRevision();
    let player: CurrentPlayer | undefined;
    try { player = await getCurrentPlayer(); } catch { return; }
    if (revision !== getIdentityRevision()) return;
    setAccount(player);
    if (!player) return;
    if (owner.current !== player.appUserId) {
      // Also handle authorization identity changes on hosts which only reveal
      // the replacement identity on a later profile read.
      if (owner.current) service.resetSession();
      owner.current = player.appUserId;
      service.restore(outbox.get(player.appUserId));
      try { outbox.save(player.appUserId, service.exportPending()); }
      catch { setStorageError('待同步成绩暂未持久保存，请在关闭前重试同步。'); }
    }
    try {
      await syncPlayerProfile(player, revision);
      if (revision === getIdentityRevision()) setProfileError('');
    } catch (error) {
      if (revision === getIdentityRevision()) setProfileError(`资料暂未同步 · ${friendlyError(error).message}`);
    }
  }, [outbox, service]);
  useEffect(() => {
    service.setReady(ready);
    if (ready) void refreshAccount();
    return () => service.setReady(false);
  }, [ready, refreshAccount, service]);
  useEffect(() => subscribeLogin(() => {
    owner.current = undefined; service.resetSession(); setAccount(undefined); setProfileError('');
    if (ready) void refreshAccount();
  }), [ready, refreshAccount, service]);
  useEffect(() => subscribeVisibility(visible => {
    if (visible && ready) { service.foreground(); void refreshAccount(); }
  }), [ready, refreshAccount, service]);
  useEffect(() => subscribeUnload(() => { service.setReady(false); owner.current = undefined; service.resetSession(); }), [service]);
  const enqueue = useCallback((result: ScoreCandidate, revision: number) => {
    if (revision === getIdentityRevision()) service.enqueue(result);
  }, [service]);
  const retry = useCallback((mode: Parameters<ScoreSync['retry']>[0]) => service.retry(mode), [service]);
  return { states, enqueue, retry, account, storageError, profileError, refreshAccount };
}
