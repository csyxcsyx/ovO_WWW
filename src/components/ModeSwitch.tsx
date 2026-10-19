import { Shield, Timer } from 'lucide-react';
import type { Mode } from '../game/types';

export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return <div className="mode-switch" data-mode={mode} role="group" aria-label="选择玩法">
    <button type="button" aria-pressed={mode === 'sprint'} onClick={() => { if (mode !== 'sprint') onChange('sprint'); }}><Timer size={19} aria-hidden="true" /><span>限时竞速</span></button>
    <button type="button" aria-pressed={mode === 'survival'} onClick={() => { if (mode !== 'survival') onChange('survival'); }}><Shield size={19} aria-hidden="true" /><span>生存挑战</span></button>
  </div>;
}
