import { useEffect, useRef, useState } from 'react';
import { ArrowDown, LoaderCircle, RefreshCw, Trophy, UserRound } from 'lucide-react';
import type { Mode } from '../game/types';
import { ModeSwitch } from './ModeSwitch';
import { getBoard, getMyEntry, subscribeLogin, type LeaderboardEntry } from '../platform/heybox';
import { friendlyError } from '../platform/errors';

export function Leaderboard({ mode, onMode, ready }: { mode: Mode; onMode: (mode: Mode) => void; ready: boolean }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [mine, setMine] = useState<LeaderboardEntry>();
  const [cursor, setCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const busy = useRef(false);
  useEffect(() => subscribeLogin(() => setRevision(n => n + 1)), []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    const id = ++requestId.current;
    setEntries([]); setMine(undefined); setHasMore(false); setCursor(undefined); setError('');
    busy.current = false;
    if (!ready) { setLoading(false); return; }
    if (Date.now() < retryAt) { setError('操作较频繁，请稍后再试。'); setLoading(false); return; }
    setLoading(true); busy.current = true;
    void Promise.allSettled([getBoard(mode), getMyEntry(mode)]).then(([board, current]) => {
      if (requestId.current !== id) return;
      if (board.status === 'fulfilled') { setEntries(board.value.entries); setCursor(board.value.cursor); setHasMore(board.value.hasMore); }
      else { const issue = friendlyError(board.reason); setError(issue.message); if (issue.retryAfterMs) setRetryAt(Date.now() + issue.retryAfterMs); }
      if (current.status === 'fulfilled') setMine(current.value);
      // 当前用户未登录或被限流时，公开榜单仍独立可读。
      if (current.status === 'rejected') { const issue = friendlyError(current.reason); if (issue.retryAfterMs) setRetryAt(Date.now() + issue.retryAfterMs); }
      setLoading(false); busy.current = false;
    });
    return () => { requestId.current++; };
  }, [mode, ready, revision]);
  async function more() {
    if (busy.current || Date.now() < retryAt || !hasMore || !cursor) return;
    busy.current = true; setLoading(true); setError('');
    const id = requestId.current;
    try {
      const page = await getBoard(mode, cursor);
      if (id !== requestId.current) return;
      setEntries(existing => [...new Map([...existing, ...page.entries].map(entry => [entry.appUserId, entry])).values()]);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (reason) {
      if (id !== requestId.current) return;
      const issue = friendlyError(reason); setError(issue.message);
      if (issue.retryAfterMs) setRetryAt(Date.now() + issue.retryAfterMs);
    } finally { if (id === requestId.current) { setLoading(false); busy.current = false; } }
  }
  const cooling = clock < retryAt;
  return <div className="leaderboard-content"><ModeSwitch mode={mode} onChange={onMode} />
    {mine && <div className="my-ranking"><UserRound size={19} aria-hidden="true" /><span>我的最佳<strong>{mine.score.toLocaleString()} {mode === 'sprint' ? '分' : '题'}</strong></span><b>{mine.ranked && mine.rank > 0 ? `第 ${mine.rank} 名` : '成绩已保存'}</b></div>}
    {!ready ? <div className="empty-state"><Trophy size={34} strokeWidth={1.4} aria-hidden="true" /><h3>在小黑盒，和大家比比眼力</h3><p>当前可直接游玩。平台连接就绪后，排行榜会在这里显示。</p></div> : <>
      {loading && !entries.length && <div className="empty-state" role="status"><LoaderCircle className="spin" size={27} aria-hidden="true" /><p>正在读取排行榜…</p></div>}
      {!loading && !entries.length && !error && <div className="empty-state"><Trophy size={34} strokeWidth={1.4} aria-hidden="true" /><h3>榜首，等你来坐</h3><p>完成一局，提交你的第一份成绩。</p></div>}
      {entries.length > 0 && <ol className="ranking-list" aria-label="排行榜">{entries.map((entry, index) => <li key={entry.appUserId} className={entry.appUserId === mine?.appUserId ? 'ranking-self' : ''}><span className={`rank-number ${index < 3 ? 'rank-top' : ''}`}>{entry.ranked && entry.rank > 0 ? String(entry.rank).padStart(2,'0') : '—'}</span><div><strong>{entry.appUserId === mine?.appUserId ? '我' : `鉴定员 · ${entry.appUserId.slice(-4)}`}</strong><span>{typeof entry.extra?.maxStreak === 'number' ? `最高 ${entry.extra.maxStreak} 连击` : '认准每一个入口'}</span></div><b>{entry.score.toLocaleString()}<small>{mode === 'sprint' ? '分' : '题'}</small></b></li>)}</ol>}
      {error && <p className="inline-message" role="status">{error}</p>}
      <div className="ranking-actions">{hasMore && <button className="button-soft" onClick={more} disabled={loading || cooling}>{loading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}查看更多</button>}<button className="button-quiet" disabled={loading || cooling} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} aria-hidden="true" />{cooling ? `${Math.max(1, Math.ceil((retryAt - clock) / 1000))} 秒后可重试` : '刷新榜单'}</button></div>
    </>}
    <p className="footnote">每种玩法独立排名，只保留个人最佳成绩。其他玩家的更新可能延迟显示。</p>
  </div>;
}
