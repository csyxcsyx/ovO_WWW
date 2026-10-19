export interface PlayerProfile { nickname: string; avatar: string }
export interface CurrentPlayer { appUserId: string; profile: PlayerProfile }

// Public display snapshots only. Never use these fields to establish identity.
export function readPlayerProfile(value: unknown): PlayerProfile | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as Record<string, unknown>;
  const nickname = typeof raw.nickname === 'string'
    ? Array.from(raw.nickname.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim()).slice(0, 64).join('') : '';
  let avatar = '';
  if (typeof raw.avatar === 'string' && raw.avatar.length <= 1024) {
    try {
      const url = new URL(raw.avatar.startsWith('//') ? `https:${raw.avatar}` : raw.avatar);
      if (url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 1024) avatar = url.href;
    } catch { /* Invalid or non-web resources use the neutral avatar. */ }
  }
  return nickname || avatar ? { nickname, avatar } : undefined;
}

export function playerPresentation(entry: { appUserId: string; extra: Record<string, unknown> }, current?: CurrentPlayer) {
  const self = current?.appUserId === entry.appUserId;
  const profile = self ? current.profile : readPlayerProfile(entry.extra.playerProfile);
  return { self, nickname: profile?.nickname || (self ? '我' : `鉴定员 · ${entry.appUserId.slice(-4)}`), avatar: profile?.avatar || '' };
}
