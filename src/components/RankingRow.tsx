import type { Mode } from '../game/types';
import type { LeaderboardEntry } from '../platform/heybox';
import { playerPresentation, type CurrentPlayer } from '../platform/playerProfile';
import { PlayerAvatar } from './PlayerAvatar';

export function RankingRow({ entry, current, isMine, mode }: {
  entry: LeaderboardEntry; current?: CurrentPlayer; isMine: boolean; mode: Mode;
}) {
  const player = playerPresentation(entry, current);
  const self = isMine || player.self;
  return <li className={self ? 'ranking-self' : ''}>
    <span className={`rank-number ${entry.ranked && entry.rank > 0 && entry.rank <= 3 ? 'rank-top' : ''}`}>{entry.ranked && entry.rank > 0 ? String(entry.rank).padStart(2, '0') : '—'}</span>
    <PlayerAvatar src={player.avatar} />
    <div className="ranking-player"><strong title={player.nickname}>{player.nickname}{self && player.nickname !== '我' && <small className="player-self-label">我</small>}</strong>
      <span>{typeof entry.extra?.maxStreak === 'number' ? `最高 ${entry.extra.maxStreak} 连击` : '认准每一个入口'}</span></div>
    <b>{entry.score.toLocaleString()}<small>{mode === 'sprint' ? '分' : '题'}</small></b>
  </li>;
}
