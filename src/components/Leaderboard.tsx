import { useEffect, useState, type RefObject } from 'react';
import { ArrowDown, LoaderCircle, RefreshCw, Trophy } from 'lucide-react';
import type { Mode } from '../game/types';
import { ModeSwitch } from './ModeSwitch';
import { playerPresentation, readPlayerProfile } from '../platform/playerProfile';
import { PlayerAvatar } from './PlayerAvatar';
import { RankingRow } from './RankingRow';
import { useLeaderboardProfiles } from '../hooks/useLeaderboardProfiles';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { BoardPersonal } from './BoardPersonal';
import type { ScoreCandidate } from '../platform/scoreCandidate';
import type { SyncState } from '../platform/scoreSync';
import type { LeaderboardStore } from '../platform/leaderboardStore';

interface Props {
  mode: Mode; onMode: (mode: Mode) => void; ready: boolean; best: Record<Mode, number>;
  scrollRef: RefObject<HTMLDivElement | null>;
  sync: Partial<Record<Mode, SyncState>>; onRetry: (mode: Mode) => void;
  onRecover: (candidate: ScoreCandidate, revision: number) => void;
  profileError: string; onProfileRetry: () => void;
  store?: LeaderboardStore;
}
export function Leaderboard({ mode, onMode, ready, scrollRef, best, sync, onRetry, onRecover, profileError, onProfileRetry, store }: Props) {
  const board = useLeaderboard(mode, ready, scrollRef, store);
  const { entries, mine, current } = board;
  const [profileRevision, setProfileRevision] = useState(0);
  const directory = useLeaderboardProfiles(entries, mine, board.revision + profileRevision);
  const [now, setNow] = useState(Date.now());
  const deadline = Math.max(board.retryAt, board.personalRetryAt);
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const cooling = now < board.retryAt;
  const myProfile = mine ? playerPresentation(mine, current, directory.data.get(mine.appUserId)) : undefined;
  const myName = current?.appUserId === mine?.appUserId ? current?.profile.nickname : mine && (directory.data.get(mine.appUserId) ?? readPlayerProfile(mine.extra.playerProfile))?.nickname;
  const busy = board.loading || board.loadingMore;
  return <div className="leaderboard-content">
    <ModeSwitch mode={mode} onChange={onMode} />
    {!ready ? <div className="empty-state"><Trophy size={34} strokeWidth={1.4} aria-hidden="true" /><h3>在小黑盒，和大家比比眼力</h3><p>平台连接就绪后，排行榜会在这里显示。</p></div> : <>
      <div className="board-personal-slot">
        {mine ? <div className="my-ranking"><PlayerAvatar src={myProfile?.avatar ?? ''} /><span><span className="my-ranking-name" title={myName || '我的最佳'}>{myName || '我的最佳'}</span><strong>{mine.score.toLocaleString()} {mode === 'sprint' ? '分' : '题'}</strong></span><b>{mine.ranked && mine.rank > 0 ? `第 ${mine.rank} 名` : '成绩已保存'}</b></div>
          : <p className="board-personal-placeholder" role="status">{board.personalError || (board.personalLoaded ? '完成挑战后，这里展示你的云端最佳成绩。' : '正在连接个人成绩…')}</p>}
      </div>
      <BoardPersonal key={`${mode}-${board.identity}`} mode={mode} best={best[mode]} mine={mine} loaded={board.personalLoaded} account={current} state={sync[mode]} ready={ready} onRetry={() => onRetry(mode)} onRecover={onRecover} />
      {!board.loaded && !board.error && <div className="board-skeleton" role="status" aria-label="正在读取排行榜"><span /><span /><span /><p>正在读取排行榜…</p></div>}
      {board.loaded && !entries.length && !board.error && <div className="empty-state"><Trophy size={34} strokeWidth={1.4} aria-hidden="true" /><h3>榜首，等你来坐</h3><p>完成一局，正成绩会自动同步。</p></div>}
      {entries.length > 0 && <ol className="ranking-list" aria-label="排行榜">{entries.map(entry => <RankingRow key={`${mode}-${entry.appUserId}`} entry={entry} current={current} profile={directory.data.get(entry.appUserId)} isMine={entry.appUserId === mine?.appUserId} mode={mode} />)}</ol>}
      {board.error && <p className="inline-message" role="status">{entries.length ? '加载失败，已显示的成绩会保留。' : '榜单暂未读取。'}{board.error}</p>}
      {board.personalError && mine && <p className="personal-ranking-note" role="status">{board.personalError}</p>}
      {(profileError || directory.error) && <p className="personal-ranking-note" role="status">{profileError || directory.error}<button className="button-soft" onClick={() => { onProfileRetry(); setProfileRevision(value => value + 1); }}>重试资料同步</button></p>}
      {board.stale && entries.length > 0 && <p className="personal-ranking-note" role="status">榜单有更新，刷新后查看最新排行。</p>}
      <div className="ranking-actions" aria-live="polite">
        {board.hasMore && !board.stale && <button className="button-soft" onClick={board.more} disabled={busy || cooling}>{board.loadingMore ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}{board.loadingMore ? '正在加载…' : board.error ? '加载失败，点击重试' : '加载更多'}</button>}
        {board.loaded && !board.hasMore && entries.length > 0 && <span className="ranking-end">已显示全部排行</span>}
        <button className="button-soft" disabled={busy || cooling} onClick={board.refresh}><RefreshCw size={16} className={board.loading ? 'spin' : undefined} aria-hidden="true" />{cooling ? `${Math.max(1, Math.ceil((board.retryAt - now) / 1000))} 秒后可重试` : board.loading && board.loaded ? '正在刷新…' : '刷新榜单'}</button>
      </div>
    </>}
    <p className="footnote">每种玩法独立排名，每人保留一条最佳成绩。其他玩家的更新可能延迟显示。</p>
    <p className="footnote">重新进入后会更新已授权的昵称和头像；暂无资料的记录保留匿名显示。</p>
    {ready && <div ref={board.sentinel} className="board-sentinel" aria-hidden="true" />}
  </div>;
}
