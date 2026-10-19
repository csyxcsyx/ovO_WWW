import { History, Info, Trophy } from 'lucide-react';

export function AuxiliaryNav({ onRecords, onRanking, onRules }: { onRecords: () => void; onRanking: () => void; onRules: () => void }) {
  return <nav className="aux-nav" aria-label="辅助导航">
    <button onClick={onRecords}><History size={18} aria-hidden="true" /><span>纪录</span></button>
    <button onClick={onRanking}><Trophy size={18} aria-hidden="true" /><span>排行</span></button>
    <button onClick={onRules}><Info size={18} aria-hidden="true" /><span>玩法</span></button>
  </nav>;
}
