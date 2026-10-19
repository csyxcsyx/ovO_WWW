import { parseCandidate, type ScoreCandidate } from './scoreCandidate';
import type { Mode } from '../game/types';

export interface PendingScore { candidate: ScoreCandidate; retryAt: number }
interface AccountOutbox { owner: string; touchedAt: number; pending: PendingScore[] }
interface OutboxData { version: 1; accounts: AccountOutbox[] }
const KEY = 'official_sync_outbox_v1';
export function parseOutbox(value: unknown): OutboxData {
  const data = value as Partial<OutboxData> | null;
  if (data?.version !== 1 || !Array.isArray(data.accounts)) return { version: 1, accounts: [] };
  const accounts = new Map<string, AccountOutbox>();
  for (const raw of data.accounts) {
    if (!raw || typeof raw.owner !== 'string' || !raw.owner || raw.owner.length > 256 || !Number.isSafeInteger(raw.touchedAt) || !Array.isArray(raw.pending)) continue;
    const byMode = new Map<Mode, PendingScore>();
    for (const item of raw.pending) {
      const candidate = parseCandidate(item?.candidate);
      if (!candidate) continue;
      const retryAt = Number.isSafeInteger(item.retryAt) && item.retryAt >= 0 ? item.retryAt : 0;
      const old = byMode.get(candidate.mode);
      if (!old || candidate.score > old.candidate.score) byMode.set(candidate.mode, { candidate, retryAt });
    }
    if (!accounts.has(raw.owner)) accounts.set(raw.owner, { owner: raw.owner, touchedAt: raw.touchedAt, pending: [...byMode.values()] });
  }
  return { version: 1, accounts: [...accounts.values()].sort((a, b) => b.touchedAt - a.touchedAt).slice(0, 5) };
}
export class SyncOutbox {
  private data: OutboxData;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'>) {
    try { this.data = parseOutbox(JSON.parse(storage.getItem(KEY) || 'null')); }
    catch { this.data = { version: 1, accounts: [] }; }
  }
  get(owner: string) { return this.data.accounts.find(item => item.owner === owner)?.pending ?? []; }
  save(owner: string, pending: PendingScore[]) {
    const account = { owner, pending, touchedAt: Date.now() };
    this.data = parseOutbox({ version: 1, accounts: [account, ...this.data.accounts.filter(item => item.owner !== owner)] });
    this.storage.setItem(KEY, JSON.stringify(this.data));
  }
}
