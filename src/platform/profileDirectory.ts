import type { LeaderboardEntry } from '@heybox/hb-sdk';
import { readPlayerProfile, type CurrentPlayer, type PlayerProfile } from './playerProfile';

interface ProfilePage { entries: LeaderboardEntry[]; hasMore: boolean; cursor?: string }
interface Ports {
  current(): Promise<LeaderboardEntry | undefined>;
  submit(score: number, profile: PlayerProfile): Promise<LeaderboardEntry>;
  list(cursor?: string): Promise<ProfilePage>;
}
const TTL = 300_000;
export class ProfileDirectory {
  private epoch = 0;
  private profiles = new Map<string, PlayerProfile>();
  private pages = new Map<string, Promise<ProfilePage>>();
  private expires = 0;
  private ownRequest?: Promise<void>;
  private ownSignature = '';
  private listeners = new Set<() => void>();
  constructor(private ports: Ports) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.listeners.forEach(listener => listener()); }
  cached(ids: string[]): Map<string, PlayerProfile> {
    return Date.now() < this.expires ? new Map(ids.flatMap(id => {
      const profile = this.profiles.get(id);
      return profile ? [[id, profile] as const] : [];
    })) : new Map();
  }
  reset() {
    this.epoch++; this.profiles.clear(); this.pages.clear(); this.expires = 0;
    this.ownRequest = undefined; this.ownSignature = ''; this.notify();
  }
  async syncOwn(player: CurrentPlayer): Promise<void> {
    const profile = readPlayerProfile(player.profile);
    if (!profile) return;
    if (this.ownRequest) {
      const epoch = this.epoch;
      await this.ownRequest;
      if (epoch === this.epoch) return this.syncOwn(player);
      return;
    }
    const signature = JSON.stringify([player.appUserId, profile]);
    if (this.ownSignature === signature) return;
    const epoch = this.epoch;
    const pending = (async () => {
      const previous = await this.ports.current();
      if (epoch !== this.epoch) return;
      if (previous && previous.appUserId !== player.appUserId) throw { code: 'AUTHORIZATION_CONTEXT_CHANGED' };
      const stored = previous && readPlayerProfile(previous.extra.playerProfile);
      let final = previous;
      if (!stored || stored.nickname !== profile.nickname || stored.avatar !== profile.avatar) {
        final = await this.ports.submit(Math.max(Date.now(), (previous?.score ?? 0) + 1), profile);
      }
      if (epoch !== this.epoch) return;
      if (!final || final.appUserId !== player.appUserId) throw { code: 'AUTHORIZATION_CONTEXT_CHANGED' };
      const saved = readPlayerProfile(final.extra.playerProfile);
      if (!saved || saved.nickname !== profile.nickname || saved.avatar !== profile.avatar) throw { code: 'PROFILE_NOT_UPDATED' };
      // A new snapshot invalidates in-flight pages; otherwise old pages can
      // overwrite the just-updated name or avatar in the local cache.
      this.pages.clear(); this.profiles.set(player.appUserId, saved);
      this.ownSignature = signature; this.notify();
    })();
    this.ownRequest = pending;
    try { await pending; } finally { if (this.ownRequest === pending) this.ownRequest = undefined; }
  }
  async resolve(ids: string[]): Promise<Map<string, PlayerProfile>> {
    if (Date.now() >= this.expires) {
      this.pages.clear(); this.profiles.clear(); this.expires = Date.now() + TTL;
    }
    const epoch = this.epoch;
    const wanted = new Set(ids);
    const visited = new Set<string>();
    let cursor: string | undefined;
    while ([...wanted].some(id => !this.profiles.has(id))) {
      const key = cursor ?? '';
      if (visited.has(key)) throw { code: 'INVALID_RESPONSE' };
      visited.add(key);
      let pending = this.pages.get(key);
      if (!pending) {
        pending = this.ports.list(cursor);
        this.pages.set(key, pending);
      }
      let page: ProfilePage;
      try { page = await pending; }
      catch (error) { if (this.pages.get(key) === pending) this.pages.delete(key); throw error; }
      if (epoch !== this.epoch) return new Map();
      // Ignore pages invalidated by a successful local profile update.
      if (this.pages.get(key) !== pending) return this.resolve(ids);
      for (const entry of page.entries) {
        const profile = readPlayerProfile(entry.extra.playerProfile);
        if (profile) this.profiles.set(entry.appUserId, profile);
      }
      if (!page.hasMore) break;
      if (!page.cursor) throw { code: 'INVALID_RESPONSE' };
      cursor = page.cursor;
    }
    return new Map([...this.profiles].filter(([id]) => wanted.has(id)));
  }
}
