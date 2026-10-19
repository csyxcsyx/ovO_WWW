import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { BrandMark } from './components/Brand';
import { AuxiliaryNav } from './components/AuxiliaryNav';
import { Home } from './components/Home';
import { Game } from './components/Game';
import { Result } from './components/Result';
import { Dialog } from './components/Dialog';
import { Rules } from './components/Rules';
import { Records } from './components/Records';
import { Review } from './components/Review';
import { Leaderboard } from './components/Leaderboard';
import { Countdown } from './components/Countdown';
import { useGame } from './hooks/useGame';
import { usePlatform } from './hooks/usePlatform';
import { useRecords } from './hooks/useRecords';
import { useScoreSync } from './hooks/useScoreSync';
import { resultFrom } from './game/engine';
import type { Mode } from './game/types';
import { getIdentityRevision, getSharedMode } from './platform/heybox';
import { scoreCandidate } from './platform/scoreCandidate';

type Panel = 'rules' | 'records' | 'ranking' | 'review' | 'exit' | null;
export default function App() {
  const platform = usePlatform();
  const records = useRecords(platform.ready);
  const sync = useScoreSync(platform.ready);
  const game = useGame();
  const [panel, setPanel] = useState<Panel>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const savedResult = useRef('');
  const countdownMode = useRef(records.data.mode);
  const countdownToken = useRef(0);
  const countdownActive = useRef(false);
  const runIdentity = useRef(getIdentityRevision());
  const active = Boolean(game.state && game.state.phase !== 'finished');
  const result = useMemo(() => game.state?.phase === 'finished' ? resultFrom(game.state) : null, [game.state]);
  useEffect(() => { if (platform.ready) { const mode = getSharedMode(); if (mode) records.setMode(mode); } }, [platform.ready]);
  useEffect(() => {
    if (!result || savedResult.current === result.id) return;
    savedResult.current = result.id;
    const saved = records.save(result);
    setNewBest(saved.isNewBest);
    setPanel(null);
    if (saved.added) sync.enqueue(scoreCandidate(result), runIdentity.current);
  }, [result, records.save, sync.enqueue]);
  useEffect(() => {
    if (countdown === null) return;
    const token = countdownToken.current;
    const timeout = setTimeout(() => {
      if (token !== countdownToken.current || !countdownActive.current) return;
      if (countdown > 1) setCountdown(countdown - 1);
      else { countdownActive.current = false; setCountdown(null); game.start(countdownMode.current); }
    }, 700);
    return () => clearTimeout(timeout);
  }, [countdown, game.start]);
  const cancelCountdown = () => { countdownToken.current++; countdownActive.current = false; setCountdown(null); };
  const begin = (mode: Mode) => {
    if (countdownActive.current) return;
    countdownActive.current = true; countdownToken.current++;
    runIdentity.current = getIdentityRevision();
    countdownMode.current = mode; setPanel(null); setCountdown(3);
  };
  const home = () => {
    cancelCountdown(); game.reset(); setPanel(null); setNewBest(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.start-button')?.focus({ preventScroll: true }));
  };
  const currentSync = result && sync.states[result.mode]?.resultId === result.id ? sync.states[result.mode] : undefined;
  return <div className={`app-shell ${active ? 'app-playing' : result ? 'app-result' : 'app-home'}`}>
    {!active && <header className="site-header">{result ? <button className="brand" onClick={home} aria-label="官网鉴定局，返回鉴定台"><BrandMark /><span>官网鉴定局<span className="brand-caption">认准每一个入口</span></span></button> : <div className="brand brand-static"><BrandMark /><span>官网鉴定局<span className="brand-caption">认准每一个入口</span></span></div>}
      <AuxiliaryNav onRecords={() => setPanel('records')} onRanking={() => setPanel('ranking')} onRules={() => setPanel('rules')} />
    </header>}
    {result ? <Result key={result.id} result={result} isNewBest={newBest} ready={platform.ready} sync={currentSync} onAgain={() => begin(result.mode)} onHome={home} onRanking={() => { records.setMode(result.mode); setPanel('ranking'); }} onReview={() => setPanel('review')} onRetry={() => sync.retry(result.mode)} />
      : game.state ? <Game state={game.state} choose={game.choose} onExit={() => setPanel('exit')} blocked={panel !== null} />
      : <Home mode={records.data.mode} best={records.data.best[records.data.mode]} onMode={records.setMode} onStart={() => begin(records.data.mode)} onRanking={() => setPanel('ranking')} onRecords={() => setPanel('records')} onRules={() => setPanel('rules')} />}
    {records.storageError && <p className="storage-notice" role="status">{records.storageError}</p>}
    {sync.storageError && <p className="storage-notice" role="status">{sync.storageError}</p>}
    {import.meta.env.DEV && <div className="dev-label">开发预览 · {platform.ready ? '平台已连接' : '本地体验'}</div>}
    {panel === 'rules' && <Dialog title="鉴定怎么玩" onClose={() => setPanel(null)}><Rules /></Dialog>}
    {panel === 'records' && <Dialog title="我的鉴定纪录" onClose={() => setPanel(null)}><Records data={records.data} /></Dialog>}
    {panel === 'ranking' && <Dialog title="眼力排行榜" onClose={() => setPanel(null)}><Leaderboard mode={records.data.mode} onMode={records.setMode} ready={platform.ready} best={records.data.best} sync={sync.states} onRetry={sync.retry} onRecover={sync.enqueue} profileError={sync.profileError} onProfileRetry={() => { void sync.refreshAccount(); }} /></Dialog>}
    {panel === 'review' && result && <Dialog title={`本局解析 · ${result.total} 题`} onClose={() => setPanel(null)}><Review history={result.history} /></Dialog>}
    {panel === 'exit' && active && <Dialog title="返回选择模式？" compact onClose={() => setPanel(null)}><p className="dialog-lead">返回后本局不计入纪录，倒计时仍在继续。</p><div className="dialog-actions"><button className="button-soft" onClick={home}>返回首页</button><button className="button-primary" onClick={() => setPanel(null)}>继续鉴定<ArrowRight size={17} aria-hidden="true" /></button></div></Dialog>}
    {countdown !== null && <Countdown value={countdown} onCancel={cancelCountdown} />}
  </div>;
}
