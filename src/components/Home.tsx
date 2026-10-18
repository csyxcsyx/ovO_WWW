import { ArrowRight, Check, Globe2, Layers3, Trophy, Zap } from 'lucide-react';
import { sites, questions } from '../data/questions';
import type { Mode } from '../game/types';
import { ModeSwitch } from './ModeSwitch';
import { HeroVisual } from './HeroVisual';

interface Props { mode: Mode; best: number; onMode: (mode: Mode) => void; onStart: () => void; onRanking: () => void }
export function Home({ mode, best, onMode, onStart, onRanking }: Props) {
  return <main className="home enter">
    <section className="home-intro">
      <div className="eyebrow"><span className="status-dot" />一场关于网址的眼力挑战</div>
      <h1>眼熟的官网，<br />未必是<span className="title-emphasis">真的<svg viewBox="0 0 140 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 8Q65 0 137 6" /></svg></span>。</h1>
      <p className="home-description">三个入口，一个真相。<span className="home-description-detail">考验你的互联网直觉。</span></p>
      <div className="home-play">
        <ModeSwitch mode={mode} onChange={onMode} />
        <div className="mode-rules" key={mode} aria-live="polite">
          {mode === 'sprint' ? <><span><Zap size={15} aria-hidden="true" />限时 60 秒</span><span>答错 −3 秒 · 连击加分</span></> : <><span><Check size={15} aria-hidden="true" />三次机会</span><span>每题 12 秒 · 越答越难</span></>}
        </div>
        <button className="button-primary start-button" onClick={onStart}>开始鉴定<ArrowRight size={21} aria-hidden="true" /></button>
        <button className="personal-best" onClick={onRanking}><Trophy size={16} aria-hidden="true" />{best > 0 ? <>个人最佳 <strong>{best.toLocaleString()}</strong><span>{mode === 'sprint' ? '分' : '题'}</span></> : <>你的第一份鉴定纪录，虚位以待</>}<ArrowRight size={15} aria-hidden="true" /></button>
      </div>
    </section>
    <HeroVisual />
    <footer className="home-footer">
      <div className="bank-stats"><span><Globe2 size={17} aria-hidden="true" /><strong>{sites.length}</strong> 个网站</span><span><Layers3 size={17} aria-hidden="true" /><strong>{questions.length}</strong> 道题目</span></div>
      <p>从日常冲浪，到游戏江湖。</p>
    </footer>
  </main>;
}
