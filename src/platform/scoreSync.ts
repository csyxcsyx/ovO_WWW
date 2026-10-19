import type { Mode } from '../game/types';
import type { ScoreCandidate } from './scoreCandidate';
import type { PendingScore } from './syncOutbox';
import type { LeaderboardEntry } from './heybox';
import { leaderboardError } from './errors';

export interface SyncState {
  resultId: string; status: 'waiting' | 'syncing' | 'synced' | 'error';
  entry?: LeaderboardEntry; message?: string; retryAt: number;
}
type Snapshot = Partial<Record<Mode, SyncState>>;
const modes: Mode[] = ['sprint', 'survival'];

// The owner is managed outside this queue; reset before changing accounts.
export class ScoreSync {
  private snapshot: Snapshot = {};
  private listeners = new Set<() => void>();
  private pending: Partial<Record<Mode, ScoreCandidate>> = {};
  private covered: Partial<Record<Mode, LeaderboardEntry>> = {};
  private running = new Set<Mode>();
  private blocked = new Set<Mode>();
  private resumed = new Set<Mode>();
  private seen = new Set<string>();
  private epoch = 0;
  private ready = false;
  constructor(private submit: (result: ScoreCandidate) => Promise<LeaderboardEntry>, private persist?: (pending: PendingScore[]) => void) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private set(mode: Mode, value: SyncState) {
    this.snapshot = { ...this.snapshot, [mode]: value };
    this.persist?.(this.exportPending());
    this.listeners.forEach(listener => listener());
  }
  setReady(ready: boolean) {
    this.ready = ready;
    if (ready) modes.forEach(mode => { void this.pump(mode); });
  }
  exportPending(): PendingScore[] {
    return modes.flatMap(mode => this.pending[mode] ? [{ candidate: this.pending[mode]!, retryAt: this.snapshot[mode]?.retryAt ?? 0 }] : []);
  }
  restore(pending: PendingScore[]) {
    for (const { candidate, retryAt } of pending) {
      if ((this.covered[candidate.mode]?.score ?? 0) >= candidate.score) continue;
      if ((this.pending[candidate.mode]?.score ?? 0) >= candidate.score) continue;
      this.pending[candidate.mode] = candidate;
      const cooling = retryAt > Date.now();
      if (cooling) this.blocked.add(candidate.mode);
      this.set(candidate.mode, { resultId: candidate.id, status: cooling ? 'error' : 'waiting', retryAt, message: cooling ? '操作较频繁，请稍后再试。' : undefined });
    }
    if (this.ready) modes.forEach(mode => { void this.pump(mode); });
  }
  enqueue(result: ScoreCandidate) {
    if (result.score <= 0 || this.seen.has(result.id)) return;
    this.seen.add(result.id);
    if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value!);
    const covered = this.covered[result.mode];
    if (covered && covered.score >= result.score && !this.pending[result.mode]) {
      this.set(result.mode, { resultId: result.id, status: 'synced', entry: covered, retryAt: 0 }); return;
    }
    const previous = this.snapshot[result.mode];
    if ((this.pending[result.mode]?.score ?? -1) < result.score) this.pending[result.mode] = result;
    this.resumed.delete(result.mode);
    // A new record must not bypass a real platform cooldown.
    if (!previous || previous.retryAt <= Date.now()) this.blocked.delete(result.mode);
    this.set(result.mode, { resultId: result.id, status: this.blocked.has(result.mode) ? 'error' : 'waiting', message: previous?.message, retryAt: previous?.retryAt ?? 0 });
    void this.pump(result.mode);
  }
  retry(mode: Mode) {
    if (!this.pending[mode] || Date.now() < (this.snapshot[mode]?.retryAt ?? 0)) return;
    this.blocked.delete(mode);
    this.resumed.delete(mode);
    void this.pump(mode);
  }
  foreground() {
    modes.forEach(mode => {
      if (!this.blocked.has(mode) || this.resumed.has(mode) || Date.now() < (this.snapshot[mode]?.retryAt ?? 0)) return;
      this.resumed.add(mode);
      this.blocked.delete(mode);
      void this.pump(mode);
    });
  }
  resetSession() {
    this.epoch++;
    this.pending = {};
    this.covered = {}; this.seen.clear();
    this.running.clear(); this.blocked.clear(); this.resumed.clear();
    this.snapshot = {};
    this.listeners.forEach(listener => listener());
  }
  private async pump(mode: Mode) {
    const result = this.pending[mode];
    if (!result || !this.ready || this.running.has(mode) || this.blocked.has(mode)) return;
    const retryAt = this.snapshot[mode]?.retryAt ?? 0;
    if (Date.now() < retryAt) return;
    const epoch = this.epoch;
    this.running.add(mode);
    this.set(mode, { resultId: this.snapshot[mode]?.resultId ?? result.id, status: 'syncing', retryAt: 0 });
    try {
      const entry = await this.submit(result);
      if (epoch !== this.epoch) return;
      if (!Number.isSafeInteger(entry.score) || entry.score < result.score) throw { code: 'INVALID_RESPONSE' };
      this.covered[mode] = entry;
      const candidate = this.pending[mode];
      if (candidate && candidate.score <= entry.score) {
        delete this.pending[mode];
        this.set(mode, { resultId: this.snapshot[mode]?.resultId ?? candidate.id, status: 'synced', entry, retryAt: 0 });
      }
    } catch (error) {
      if (epoch !== this.epoch) return;
      const issue = leaderboardError(error, 'submit');
      this.blocked.add(mode);
      this.set(mode, { resultId: this.snapshot[mode]?.resultId ?? this.pending[mode]?.id ?? result.id, status: 'error',
        message: issue.message, retryAt: issue.retryAfterMs ? Date.now() + issue.retryAfterMs : 0 });
    } finally {
      if (epoch === this.epoch) {
        this.running.delete(mode);
        if (!this.blocked.has(mode)) void this.pump(mode);
      }
    }
  }
}
