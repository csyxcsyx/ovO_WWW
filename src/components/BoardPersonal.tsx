import { useState } from 'react';
import type { Mode } from '../game/types';
import type { CurrentPlayer } from '../platform/playerProfile';
import { getIdentityRevision, type LeaderboardEntry } from '../platform/heybox';
import type { ScoreCandidate } from '../platform/scoreCandidate';
import type { SyncState } from '../platform/scoreSync';
import { Dialog } from './Dialog';
import { SyncStatus } from './SyncStatus';

export function BoardPersonal({ mode, best, mine, loaded, account, state, ready, onRetry, onRecover }: {
  mode: Mode; best: number; mine?: LeaderboardEntry; loaded: boolean; account?: CurrentPlayer;
  state?: SyncState; ready: boolean; onRetry: () => void;
  onRecover: (candidate: ScoreCandidate, revision: number) => void;
}) {
  const [confirmation, setConfirmation] = useState<{ owner: string; name: string; revision: number }>();
  const pending = state && state.status !== 'synced';
  const recoverable = loaded && account && best > 0 && best > (mine?.score ?? 0) && !pending;
  return <>
    {state && <SyncStatus state={state} isNewBest={false} ready={ready} onRetry={onRetry} />}
    {recoverable && <div className="board-recovery"><p>本机最佳 {best.toLocaleString()} {mode === 'sprint' ? '分' : '题'} 尚未同步</p>
      <button className="button-soft" onClick={() => setConfirmation({ owner: account.appUserId, name: account.profile.nickname || '当前小黑盒账号', revision: getIdentityRevision() })}>补传本机纪录</button></div>}
    {confirmation && <Dialog title="补传本机纪录？" compact onClose={() => setConfirmation(undefined)}>
      <p className="dialog-lead">将本机{mode === 'sprint' ? '竞速' : '生存'}最佳 {best.toLocaleString()} {mode === 'sprint' ? '分' : '题'}上传至「{confirmation.name}」。旧纪录没有账号归属，请确认这是你的成绩。</p>
      <div className="dialog-actions"><button className="button-soft" onClick={() => setConfirmation(undefined)}>取消</button>
        <button className="button-primary" onClick={() => {
          if (confirmation.owner === account?.appUserId && confirmation.revision === getIdentityRevision()) {
            onRecover({ id: `recover-${mode}-${Date.now()}`, mode, score: best }, confirmation.revision);
          }
          setConfirmation(undefined);
        }}>是我的成绩，补传</button></div>
    </Dialog>}
  </>;
}
