// Development-only entry: actual leaderboard UI and public SDK, no seeded scores.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { usePlatform } from './hooks/usePlatform';
import { Dialog } from './components/Dialog';
import { Leaderboard } from './components/Leaderboard';
import type { Mode } from './game/types';
import './theme.css';
import './layout.css';

function BoardFixture() {
  const platform = usePlatform();
  const [mode, setMode] = useState<Mode>(new URL(location.href).searchParams.get('mode') === 'survival' ? 'survival' : 'sprint');
  return <main className="app-shell"><Dialog title="眼力排行榜" onClose={() => location.assign('/')}><Leaderboard mode={mode} onMode={setMode} ready={platform.ready} /></Dialog></main>;
}
createRoot(document.getElementById('root')!).render(<BoardFixture />);
