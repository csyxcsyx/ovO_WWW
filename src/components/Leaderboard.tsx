import { useEffect, useRef, useState } from 'react';
import { ArrowDown, LoaderCircle, RefreshCw, Trophy } from 'lucide-react';
import type { Mode } from '../game/types';
import { ModeSwitch } from './ModeSwitch';
import { getBoard, getMyEntry, getCurrentPlayer, subscribeBoardChange, subscribeVisibility, type LeaderboardEntry } from '../platform/heybox';
import { leaderboardError } from '../platform/errors';
import { playerPresentation, readPlayerProfile, type CurrentPlayer } from '../platform/playerProfile';
import { PlayerAvatar } from './PlayerAvatar';
import { RankingRow } from './RankingRow';
import { useLeaderboardProfiles } from '../hooks/useLeaderboardProfiles';
import { BoardPersonal } from './BoardPersonal';
import type { ScoreCandidate } from '../platform/scoreCandidate';
import type { SyncState } from '../platform/scoreSync';

interface Props {
  mode: Mode; onMode: (mode: Mode) => void; ready: boolean; best: Record<Mode, number>;
  sync: Partial<Record<Mode, SyncState>>; onRetry: (mode: Mode) => void;
  onRecover: (candidate: ScoreCandidate, revision: number) => void;
  profileError: string; onProfileRetry: () => void;
}
export function Leaderboard(props: Props) {
  return <div className="leaderboard-content"><ModeSwitch mode={props.mode} onChange={props.onMode} /><BoardView key={props.mode} {...props} /></div>;
}
function BoardView({ mode, ready, best, sync, onRetry, onRecover, profileError, onProfileRetry }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [mine, setMine] = useState<LeaderboardEntry>();
  const [current, setCurrent] = useState<CurrentPlayer>();
  const [cursor, setCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [error, setError] = useState('');
  const [personalError, setPersonalError] = useState('');
  const [personalLoaded, setPersonalLoaded] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const personalRetryAt = useRef(0);
  const [clock, setClock] = useState(Date.now());
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const busy = useRef(false);
  const listRetry = useRef(0);
  const directory = useLeaderboardProfiles(entries, mine, revision);
  useEffect(() => subscribeBoardChange(changed => {
    if (changed && changed !== mode) return;
    if (!changed) { setEntries([]); setMine(undefined); setCurrent(undefined); setPersonalError(''); setPersonalLoaded(false); }
    setRevision(n => n + 1);
  }), [mode]);
  useEffect(() => subscribeVisibility(visible => { if (visible) setRevision(n => n + 1); }), []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    const id = ++requestId.current;
    if (!ready) { setLoading(false); setPersonalLoading(false); return; }
    void getCurrentPlayer().then(player => { if (requestId.current === id) setCurrent(player); });
    // Public list and personal identity resolve independently; a slow/unauthorized
    // personal call must never hold the public list's loading or error state.
    if (Date.now() >= listRetry.current) {
      setLoading(true); busy.current = true; setError('');
      void getBoard(mode).then(page => {
        if (requestId.current !== id) return;
        setEntries(page.entries); setCursor(page.cursor); setHasMore(page.hasMore);
      }).catch(reason => {
        if (requestId.current !== id) return;
        const issue = leaderboardError(reason, 'list'); setError(issue.message);
        if (issue.retryAfterMs) { listRetry.current = Date.now() + issue.retryAfterMs; setRetryAt(listRetry.current); setClock(Date.now()); }
      }).finally(() => { if (requestId.current === id) { setLoading(false); busy.current = false; } });
    } else { setLoading(false); busy.current = false; }
    if (Date.now() >= personalRetryAt.current) {
      setPersonalLoading(true); setPersonalError(''); setPersonalLoaded(false);
      void getMyEntry(mode).then(entry => { if (requestId.current === id) { setMine(entry); setPersonalLoaded(true); } }).catch(reason => {
        if (requestId.current !== id) return;
        const issue = leaderboardError(reason, 'personal'); setMine(undefined); setPersonalError(issue.message);
        if (issue.retryAfterMs) personalRetryAt.current = Date.now() + issue.retryAfterMs;
      }).finally(() => { if (requestId.current === id) setPersonalLoading(false); });
    } else setPersonalLoading(false);
    return () => { requestId.current++; };
  }, [mode, ready, revision]);
  async function more() {
    if (busy.current || Date.now() < listRetry.current || !hasMore || !cursor) return;
    busy.current = true; setLoading(true); setError('');
    const id = requestId.current;
    try {
      const page = await getBoard(mode, cursor);
      if (id !== requestId.current) return;
      setEntries(existing => [...new Map([...existing, ...page.entries].map(entry => [entry.appUserId, entry])).values()]);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (reason) {
      if (id !== requestId.current) return;
      const issue = leaderboardError(reason, 'list'); setError(issue.message);
      if (issue.retryAfterMs) { listRetry.current = Date.now() + issue.retryAfterMs; setRetryAt(listRetry.current); setClock(Date.now()); }
    } finally { if (id === requestId.current) { setLoading(false); busy.current = false; } }
  }
  const cooling = clock < retryAt;
  const myProfile = mine ? playerPresentation(mine, current, directory.data.get(mine.appUserId)) : undefined;
  const myName = current?.appUserId === mine?.appUserId ? current?.profile.nickname : mine && (directory.data.get(mine.appUserId) ?? readPlayerProfile(mine.extra.playerProfile))?.nickname;
  return <>
    {mine && <div className="my-ranking"><PlayerAvatar src={myProfile?.avatar ?? ''} /><span><span className="my-ranking-name" title={myName || '我的最佳'}>{myName || '我的最佳'}</span><strong>{mine.score.toLocaleString()} {mode === 'sprint' ? '分' : '题'}</strong></span><b>{mine.ranked && mine.rank > 0 ? `第 ${mine.rank} 名` : '成绩已保存'}</b></div>}
    {!ready ? <div className="empty-state"><Trophy size={34} strokeWidth={1.4} aria-hidden="true" /><h3>在小黑盒，和大家比比眼力</h3><p>平台连接就绪后，排行榜会在这里显示。</p></div> : <>
      <BoardPersonal mode={mode} best={best[mode]} mine={mine} loaded={personalLoaded} account={current} state={sync[mode]} ready={ready} onRetry={() => onRetry(mode)} onRecover={onRecover} />
      {loading && !entries.length && <div className="empty-state" role="status"><LoaderCircle className="spin" size={27} aria-hidden="true" /><p>正在读取排行榜…</p></div>}
      {!loading && !entries.length && !error && <div className="empty-state"><Trophy size={34} strokeWidth={1.4} aria-hidden="true" /><h3>榜首，等你来坐</h3><p>完成一局，正成绩会自动同步。</p></div>}
      {entries.length > 0 && <ol className="ranking-list" aria-label="排行榜">{entries.map(entry => <RankingRow key={entry.appUserId} entry={entry} current={current} profile={directory.data.get(entry.appUserId)} isMine={entry.appUserId === mine?.appUserId} mode={mode} />)}</ol>}
      {error && <p className="inline-message" role="status">{error}</p>}
      {personalLoading && !mine && <p className="personal-ranking-note" role="status">正在连接个人成绩…</p>}
      {personalError && <p className="personal-ranking-note" role="status">{personalError}</p>}
      {(profileError || directory.error) && <p className="personal-ranking-note" role="status">{profileError || directory.error}<button className="button-soft" onClick={() => { onProfileRetry(); setRevision(n => n + 1); }}>重试资料同步</button></p>}
      <div className="ranking-actions">{hasMore && <button className="button-soft" onClick={more} disabled={loading || cooling}>{loading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}查看更多</button>}<button className="button-soft" disabled={loading || cooling} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} aria-hidden="true" />{cooling ? `${Math.max(1, Math.ceil((retryAt - clock) / 1000))} 秒后可重试` : '刷新榜单'}</button></div>
    </>}
    <p className="footnote">每种玩法独立排名，每人保留一条最佳成绩。其他玩家的更新可能延迟显示。</p>
    <p className="footnote">重新进入后会更新已授权的昵称和头像；暂无资料的记录保留匿名显示。</p>
  </>;
}
