import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Copy, LoaderCircle, RotateCcw, Share2, Trophy } from 'lucide-react';
import type { GameResult } from '../game/types';
import { MODE_LABEL } from '../game/types';
import { friendlyError } from '../platform/errors';
import { copyGameLink, shareResult, submitResult } from '../platform/heybox';
import { Review } from './Review';
import { BrandMark } from './Brand';

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
export function Result({ result, isNewBest, ready, onAgain, onHome, onRanking }: { result: GameResult; isNewBest: boolean; ready: boolean; onAgain: () => void; onHome: () => void; onRanking: () => void }) {
  const receipt = useRef<HTMLDivElement>(null);
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'share' | 'submit' | 'copy' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const pending = useRef(false);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [result.id]);
  useEffect(() => { if (!retryAt) return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [retryAt]);
  async function run(action: 'share' | 'submit' | 'copy') {
    if (pending.current || !ready || (action === 'submit' && Date.now() < retryAt)) return;
    pending.current = true; setBusy(action); setMessage('');
    try {
      if (action === 'submit') {
        const entry = await submitResult(result);
        setSubmitted(true);
        setMessage(`榜单最佳 ${entry.score.toLocaleString()} ${result.mode === 'sprint' ? '分' : '题'}${entry.ranked && entry.rank > 0 ? ` · 第 ${entry.rank} 名` : ' · 成绩已保存'}`);
      } else if (action === 'copy') { await copyGameLink(result.mode); setMessage('挑战链接已复制，邀朋友比比眼力。'); }
      else {
        receipt.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const type = await shareResult(result.mode, receipt.current!);
        setMessage(type === 'link' ? '当前使用链接分享，挑战链接已复制。' : '截图分享流程已打开，是否发送由你确认。');
      }
    } catch (error) { const issue = friendlyError(error); setMessage(issue.message); if (issue.retryAfterMs) setRetryAt(Date.now() + issue.retryAfterMs); }
    finally { pending.current = false; setBusy(null); }
  }
  const accuracy = result.total ? Math.round(result.correct / result.total * 100) : 0;
  return <main className="result-page enter">
    <div className="result-heading"><span className="eyebrow"><span className="status-dot" />本局鉴定结束</span><h1>{isNewBest ? '眼力，刷新纪录。' : '你的眼力，有数了。'}</h1></div>
    <div className="receipt" ref={receipt}>
      <div className="receipt-top"><span><BrandMark />官网鉴定局</span><span>{MODE_LABEL[result.mode]}</span></div>
      <div className="result-score"><span>{result.mode === 'sprint' ? '本局得分' : '成功认出'}</span><strong><AnimatedNumber value={result.score} /><small>{result.mode === 'sprint' ? '分' : '题'}</small></strong><span className="result-badge">{isNewBest ? <><Trophy size={14} aria-hidden="true" />个人新纪录</> : result.correct > 0 ? <><Check size={14} aria-hidden="true" />每一次认准，都算进步</> : '下一次，仔细看一点'}</span></div>
      <div className="receipt-stats"><div><strong>{accuracy}<small>%</small></strong><span>正确率</span></div><div><strong>{result.correct}<small>/{result.total}</small></strong><span>答对题数</span></div><div><strong>{result.maxStreak}</strong><span>最长连击</span></div></div>
      <div className="receipt-watermark-space" aria-hidden="true" />
    </div>
    <div className="result-actions"><button className="button-primary" onClick={onAgain}><RotateCcw size={18} aria-hidden="true" />再来一局</button><button className="button-soft" onClick={() => run('share')} disabled={!ready || busy !== null}>{busy === 'share' ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}分享成绩</button></div>
    <div className="result-secondary"><button className="button-quiet" disabled={!ready || busy !== null || submitted || clock < retryAt} onClick={() => run('submit')}>{busy === 'submit' ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Trophy size={16} aria-hidden="true" />}{submitted ? '已同步最佳成绩' : clock < retryAt ? '稍后可提交' : '提交到排行榜'}</button><button className="button-quiet" disabled={!ready || busy !== null} onClick={() => run('copy')}><Copy size={16} aria-hidden="true" />复制挑战链接</button></div>
    {!ready && <p className="result-platform-note">个人纪录已保留；排行与分享需在小黑盒中使用。</p>}
    {message && <p className="inline-message" role="status">{message}</p>}
    <div className="review-toggle-row"><button className="review-toggle" aria-expanded={review} aria-controls="result-review" onClick={() => setReview(v => !v)}>本局解析<span>{result.total} 题</span><ChevronDown size={18} className={review ? 'rotate' : ''} aria-hidden="true" /></button><button className="button-quiet" onClick={onRanking}>看排行<ArrowRight size={16} aria-hidden="true" /></button></div>
    <div id="result-review">{review && <Review history={result.history} />}</div>
    <button className="result-home button-quiet" onClick={onHome}>返回鉴定台</button>
  </main>;
}
