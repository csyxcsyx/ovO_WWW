import { useState } from 'react';
import { UserRound } from 'lucide-react';

export function PlayerAvatar({ src }: { src: string }) {
  const [failed, setFailed] = useState('');
  return <span className="player-avatar" aria-hidden="true">
    {src && failed !== src
      ? <img src={src} alt="" referrerPolicy="no-referrer" decoding="async" onError={() => setFailed(src)} />
      : <UserRound size={20} strokeWidth={1.6} />}
  </span>;
}
