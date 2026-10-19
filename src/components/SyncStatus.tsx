import { useEffect, useState } from 'react';
import { Check, LoaderCircle, RefreshCw } from 'lucide-react';
import type { SyncState } from '../platform/scoreSync';

export function SyncStatus({ state, isNewBest, ready, onRetry }: { state?: SyncState; isNewBest: boolean; ready: boolean; onRetry: () => void }) {
  const [now, setNow] = useState(Date.now());
  const retryAt = state?.retryAt ?? 0;
  useEffect(() => {
    if (!retryAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  if (!state) return <div className="sync-status" role="status">{isNewBest ? '新纪录已保存在本机' : '本局纪录已保存'}</div>;
  const cooling = now < retryAt;
  return <div className="sync-status" role="status">
    {state.status === 'synced' ? <><Check size={15} aria-hidden="true" /><span>已同步 · 榜单最佳 {state.entry!.score.toLocaleString()}{state.entry!.ranked && state.entry!.rank > 0 ? ` · 第 ${state.entry!.rank} 名` : ''}</span></>
      : state.status === 'error' ? <><span>暂未同步 · {state.message}</span><button className="sync-retry" disabled={cooling || !ready} onClick={onRetry} title={!ready ? '平台连接后可重试' : undefined}><RefreshCw size={14} aria-hidden="true" />{cooling ? `${Math.max(1, Math.ceil((retryAt - now) / 1000))}秒` : '重试'}</button></>
      : <><LoaderCircle size={15} className={state.status === 'syncing' ? 'spin' : ''} aria-hidden="true" /><span>{state.status === 'syncing' ? '成绩同步中…' : '成绩待同步，平台连接后自动上传'}</span></>}
  </div>;
}
