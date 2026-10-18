import { Check, Globe2, Search, ShieldCheck } from 'lucide-react';
import './HeroVisual.css';

export function HeroVisual() {
  return <div className="hero-visual" aria-hidden="true">
    <div className="orbit orbit-outer" /><div className="orbit orbit-inner" />
    <span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" />
    <div className="slip-position slip-position-back">
      <div className="browser-slip slip-back"><div className="slip-chrome"><i /><i /><i /></div><span>https://xiaoheie.cn</span></div>
    </div>
    <div className="slip-position slip-position-front">
      <div className="browser-slip slip-front">
        <div className="slip-chrome"><i /><i /><i /><span>官网入口</span><Globe2 size={13} /></div>
        <div className="slip-body"><span className="slip-brand">小黑盒<span>HEYBOX</span></span><span className="slip-address">https://<strong>xiaoheihe.cn</strong>/</span><div className="slip-skeleton"><i /><i /></div></div>
      </div>
    </div>
    <div className="magnifier-position"><div className="magnifier"><div className="magnifier-glass"><Search size={37} strokeWidth={1.5} /><span>.cn</span></div><i /></div></div>
    <div className="verified-position"><div className="verified-sticker"><ShieldCheck size={20} /><span>真官网，认准了。</span><Check size={16} /></div></div>
  </div>;
}
