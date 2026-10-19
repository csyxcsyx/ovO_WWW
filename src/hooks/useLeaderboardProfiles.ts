import { useEffect, useState } from 'react';
import { profiles } from '../platform/profiles';
import { friendlyError } from '../platform/errors';
import type { PlayerProfile } from '../platform/playerProfile';
import type { LeaderboardEntry } from '../platform/heybox';

export function useLeaderboardProfiles(entries: LeaderboardEntry[], mine: LeaderboardEntry | undefined, revision: number) {
  const ids = [...new Set([...entries.map(entry => entry.appUserId), ...(mine ? [mine.appUserId] : [])])];
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [data, setData] = useState(() => profiles.cached(ids));
  const [error, setError] = useState('');
  useEffect(() => profiles.subscribe(() => setDirectoryRevision(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    if (!ids.length) { setData(new Map()); return; }
    void profiles.resolve(ids).then(result => { if (active) { setData(result); setError(''); } }).catch(reason => {
      if (active) setError(`部分资料暂未更新 · ${friendlyError(reason).message}`);
    });
    return () => { active = false; };
  }, [entries, mine, revision, directoryRevision]);
  return { data: new Map([...data, ...profiles.cached(ids)]), error };
}
