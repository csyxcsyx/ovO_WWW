import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, LoaderCircle, RotateCcw, Share2, Trophy } from 'lucide-react';
import type { GameResult } from '../game/types';
import { MODE_LABEL } from '../game/types';
import type { SyncState } from '../platform/scoreSync';
import { friendlyError } from '../platform/errors';
import { shareResult } from '../platform/heybox';
import { BrandMark } from './Brand';
import { SyncStatus } from './SyncStatus';

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return; }
    const start = performance.now();
    let frame: number;
    const update = (now: number) => { const progress = Math.min(1, (now - start) / 650); setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3)))); if (progress < 1) frame = requestAnimationFrame(update); };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <><span aria-hidden="true">{display.toLocaleString()}</span><span className="sr-only">{value}</span></>;
}
interface Props {
  result: GameResult; isNewBest: boolean; ready: boolean; sync?: SyncState;
  onAgain: () => void; onHome: () => void; onRanking: () => void; onReview: () => void; onRetry: () => void;
}
export function Result({ result, isNewBest, ready, sync, onAgain, onHome, onRanking, onReview, onRetry }: Props) {
  const receipt = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function share() {
    if (pending.current || !ready) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      receipt.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const type = await shareResult(result.mode, receipt.current!);
      setMessage(type === 'link' ? '挑战链接已复制。' : '截图分享已打开，由你确认发送。');
    } catch (error) { setMessage(friendlyError(error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  const accuracy = result.total ? Math.round(result.correct / result.total * 100) : 0;
  return <main className="result-page enter">
    <div className="result-heading"><span className="eyebrow">本局鉴定结束 · {MODE_LABEL[result.mode]}</span><h1>{isNewBest ? '眼力，刷新纪录。' : '你的眼力，有数了。'}</h1></div>
    <div className="result-content">
      <div className="receipt" ref={receipt}>
        <div className="receipt-top"><span><BrandMark />官网鉴定局</span><span>{MODE_LABEL[result.mode]}</span></div>
        <div className="result-score"><span>{result.mode === 'sprint' ? '本局得分' : '本局答对'}</span><strong><AnimatedNumber value={result.score} /><small>{result.mode === 'sprint' ? '分' : '题'}</small></strong>{isNewBest && <span className="result-badge"><Trophy size={14} aria-hidden="true" />个人新纪录</span>}</div>
        <div className="receipt-stats"><div><strong>{accuracy}<small>%</small></strong><span>正确率</span></div><div><strong>{result.correct}<small>/{result.total}</small></strong><span>答对题数</span></div><div><strong>{result.maxStreak}</strong><span>最长连击</span></div></div>
        <div className="receipt-watermark-space" aria-hidden="true" />
      </div>
    </div>
    <div className="result-controls">
      <SyncStatus state={sync} isNewBest={isNewBest} ready={ready} onRetry={onRetry} />
      <div className="result-actions"><button className="button-primary" onClick={onAgain}><RotateCcw size={18} aria-hidden="true" />再来一局</button><button className="button-soft" onClick={onHome}><ArrowLeft size={18} aria-hidden="true" />选择模式</button></div>
      <div className="result-tools"><button className="button-quiet" onClick={share} disabled={!ready || busy}>{busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}分享成绩</button><button className="button-quiet" onClick={onReview}><BookOpen size={17} aria-hidden="true" />本局解析</button><button className="button-quiet" onClick={onRanking}>看排行<ArrowRight size={17} aria-hidden="true" /></button></div>
      {message && <p className="result-message" role="status">{message}</p>}
    </div>
  </main>;
}
