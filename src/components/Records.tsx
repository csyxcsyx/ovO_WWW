import { History, Shield, Timer, Trophy } from 'lucide-react';
import { MODE_LABEL } from '../game/types';
import type { SavedData } from '../platform/records';

export function Records({ data }: { data: SavedData }) {
  return <div><div className="record-bests">{(['sprint','survival'] as const).map(mode => <div key={mode}><span>{mode === 'sprint' ? <Timer size={17} aria-hidden="true" /> : <Shield size={17} aria-hidden="true" />}{MODE_LABEL[mode]}</span><strong>{data.best[mode].toLocaleString()}<small>{mode === 'sprint' ? '分' : '题'}</small></strong></div>)}</div>
    <div className="section-label"><History size={16} aria-hidden="true" />最近鉴定</div>
    {!data.recent.length ? <div className="empty-state"><Trophy size={32} strokeWidth={1.4} aria-hidden="true" /><h3>第一份纪录，从这一局开始</h3><p>完成挑战后，你的成绩会出现在这里。</p></div> : <ol className="record-list">{data.recent.map(r => <li key={r.id}><span className="record-mode-icon" aria-hidden="true">{r.mode === 'sprint' ? <Timer size={19} /> : <Shield size={19} />}</span><div><strong>{MODE_LABEL[r.mode]}</strong><span>{new Date(r.finishedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 答对 {r.correct}/{r.total}</span></div><b>{r.score.toLocaleString()}<small>{r.mode === 'sprint' ? '分' : '题'}</small></b></li>)}</ol>}
    <p className="footnote">个人纪录保留在当前设备，最多保存最近 20 局。</p>
  </div>;
}
