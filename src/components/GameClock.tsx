import { useEffect, useRef, useState } from 'react';
import { secondsLeft } from '../game/engine';

export function GameClock({ deadline, limit, penalty }: { deadline: number; limit: number; penalty: boolean }) {
  const [seconds, setSeconds] = useState(() => secondsLeft(deadline, Date.now()));
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    let previous = -1;
    const update = () => {
      const now = Date.now();
      const next = secondsLeft(deadline, now);
      if (previous !== next) { previous = next; setSeconds(next); }
      if (track.current) track.current.style.transform = `scaleX(${Math.max(0, Math.min(1, (deadline - now) / limit))})`;
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [deadline, limit]);
  return <div className={`game-clock ${seconds <= 5 ? 'clock-urgent' : ''}`}>
    <div className="timer-display" role="timer" aria-live="off" aria-label={`剩余 ${seconds} 秒`}>
      <span className="timer-number">{String(seconds).padStart(2, '0')}</span><span>秒</span>
      <span className="time-penalty" role="status">{penalty ? '答错 −3 秒' : ''}</span>
    </div>
    <div className="time-track" aria-hidden="true"><div ref={track} /></div>
  </div>;
}
