import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, History, Info, Trophy } from 'lucide-react';
import { BrandMark } from './components/Brand';
import { Home } from './components/Home';
import { Game } from './components/Game';
import { Result } from './components/Result';
import { Dialog } from './components/Dialog';
import { Rules } from './components/Rules';
import { Records } from './components/Records';
import { Leaderboard } from './components/Leaderboard';
import { Countdown } from './components/Countdown';
import { useGame } from './hooks/useGame';
import { usePlatform } from './hooks/usePlatform';
import { useRecords } from './hooks/useRecords';
import { resultFrom } from './game/engine';
import { getSharedMode } from './platform/heybox';

type Panel = 'rules' | 'records' | 'ranking' | 'exit' | null;
export default function App() {
  const platform = usePlatform();
  const records = useRecords(platform.ready);
  const game = useGame();
  const [panel, setPanel] = useState<Panel>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const savedResult = useRef('');
  const countdownMode = useRef(records.data.mode);
  const active = Boolean(game.state && game.state.phase !== 'finished');
  const result = useMemo(() => game.state?.phase === 'finished' ? resultFrom(game.state) : null, [game.state]);
  useEffect(() => { if (platform.ready) { const mode = getSharedMode(); if (mode) records.setMode(mode); } }, [platform.ready]);
  useEffect(() => {
    if (!result || savedResult.current === result.id) return;
    savedResult.current = result.id;
    setNewBest(result.score > records.data.best[result.mode]);
    records.save(result);
  }, [result, records.save]);
  useEffect(() => {
    if (countdown === null) return;
    const timeout = setTimeout(() => {
      if (countdown > 1) setCountdown(countdown - 1);
      else { setCountdown(null); game.start(countdownMode.current); }
    }, 700);
    return () => clearTimeout(timeout);
  }, [countdown, game.start]);
  useEffect(() => {
    if (countdown !== null) {
      const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setCountdown(null); };
      window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel);
    }
  }, [countdown]);
  const begin = () => { if (countdown !== null) return; countdownMode.current = result?.mode ?? records.data.mode; setPanel(null); setCountdown(3); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const home = () => { game.reset(); setPanel(null); window.scrollTo({ top: 0, behavior: 'instant' }); };
  return <div className="app-shell">
    <header className="site-header"><button className="brand" onClick={() => active ? setPanel('exit') : home()} aria-label="官网鉴定局，返回鉴定台"><BrandMark /><span>官网鉴定局<span className="brand-caption">认准每一个入口</span></span></button>
      {!active && <nav aria-label="辅助导航"><button onClick={() => setPanel('records')}><History size={18} aria-hidden="true" /><span>纪录</span></button><button onClick={() => setPanel('ranking')}><Trophy size={18} aria-hidden="true" /><span>排行</span></button><button onClick={() => setPanel('rules')}><Info size={18} aria-hidden="true" /><span>玩法</span></button></nav>}
      {active && <span className="header-playing"><span className="status-dot" />鉴定进行中</span>}
    </header>
    {result ? <Result key={result.id} result={result} isNewBest={newBest} ready={platform.ready} onAgain={begin} onHome={home} onRanking={() => { records.setMode(result.mode); setPanel('ranking'); }} /> : game.state ? <Game state={game.state} now={game.now} choose={game.choose} onExit={() => setPanel('exit')} blocked={panel !== null} /> : <Home mode={records.data.mode} best={records.data.best[records.data.mode]} onMode={records.setMode} onStart={begin} onRanking={() => setPanel('ranking')} />}
    {records.storageError && <p className="storage-notice" role="status">{records.storageError}</p>}
    {import.meta.env.DEV && <div className="dev-label">开发预览 · {platform.ready ? '平台已连接' : '本地体验'}</div>}
    {panel === 'rules' && <Dialog title="鉴定怎么玩" onClose={() => setPanel(null)}><Rules /></Dialog>}
    {panel === 'records' && <Dialog title="我的鉴定纪录" onClose={() => setPanel(null)}><Records data={records.data} /></Dialog>}
    {panel === 'ranking' && <Dialog title="眼力排行榜" onClose={() => setPanel(null)}><Leaderboard mode={records.data.mode} onMode={records.setMode} ready={platform.ready} /></Dialog>}
    {panel === 'exit' && active && <Dialog title="结束本次鉴定？" compact onClose={() => setPanel(null)}><p className="dialog-lead">退出后本局不计入纪录，倒计时仍在继续。</p><div className="dialog-actions"><button className="button-soft" onClick={home}>结束本局</button><button className="button-primary" onClick={() => setPanel(null)}>继续鉴定<ArrowRight size={17} aria-hidden="true" /></button></div></Dialog>}
    {countdown !== null && <Countdown value={countdown} onCancel={() => setCountdown(null)} />}
  </div>;
}
