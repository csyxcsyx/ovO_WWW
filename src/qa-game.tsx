// Standalone layout fixture. Not imported by the application or production entry.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './components/Game';
import { questions } from './data/questions';
import { answerTurn, startGame } from './game/engine';
import './theme.css';
import './layout.css';

function LongUrlFixture() {
  const [state, setState] = useState(() => {
    const question = questions.reduce((longest, candidate) => Math.max(...candidate.choices.map(c => c.url.length)) > Math.max(...longest.choices.map(c => c.url.length)) ? candidate : longest);
    return { ...startGame('sprint', Date.now()), question, choices: question.choices, questionSequence: 10 };
  });
  return <div className="app-shell app-playing"><Game state={state} blocked={false} choose={intent => setState(current => answerTurn(current, intent, Date.now()))} onExit={() => window.location.assign('/')} /></div>;
}
createRoot(document.getElementById('root')!).render(<LongUrlFixture />);
