import type { LeaderboardEntry } from '@heybox/hb-sdk';
import type { Mode } from '../game/types';
import type { CurrentPlayer } from './playerProfile';
import { leaderboardError } from './errors';

export interface BoardPage { entries: LeaderboardEntry[]; cursor?: string; hasMore: boolean }
interface Ports {
  list(mode: Mode, cursor?: string): Promise<BoardPage>;
  personal(mode: Mode): Promise<LeaderboardEntry | undefined>;
  player(): Promise<CurrentPlayer | undefined>;
}
export interface BoardSnapshot {
  entries: LeaderboardEntry[]; cursor?: string; hasMore: boolean;
  loaded: boolean; loading: boolean; loadingMore: boolean;
  error: string; retryAt: number; stale: boolean;
  mine?: LeaderboardEntry; current?: CurrentPlayer;
  personalLoaded: boolean; personalLoading: boolean; personalError: string;
  personalRetryAt: number; revision: number; identity: number;
}
const MODES: Mode[] = ['sprint', 'survival'];
export const BOARD_CACHE_MS = 300_000;
export const BOARD_BOTTOM_MARGIN = 120;
const empty = (identity: number): BoardSnapshot => ({
  entries: [], hasMore: false, loaded: false, loading: false, loadingMore: false,
  error: '', retryAt: 0, stale: false, personalLoaded: false,
  personalLoading: false, personalError: '', personalRetryAt: 0, revision: 0, identity,
});
interface Session {
  snapshot: BoardSnapshot; scrollTop: number; updatedAt: number; personalUpdatedAt: number;
  listVersion: number; personalVersion: number; cursors: Set<string>;
  listRequest?: Promise<void>; personalRequest?: Promise<void>;
}
const session = (identity: number): Session => ({
  snapshot: empty(identity), scrollTop: 0, updatedAt: 0, personalUpdatedAt: 0,
  listVersion: 0, personalVersion: 0, cursors: new Set(),
});

// A presentation cache survives modal unmounts. Network/identity ownership stays
// in the platform adapter; request generations prevent old responses returning.
export class LeaderboardStore {
  private identity = 0;
  private boards = { sprint: session(0), survival: session(0) };
  private listeners = new Set<() => void>();
  constructor(private ports: Ports) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (mode: Mode) => this.boards[mode].snapshot;
  getScroll = (mode: Mode) => this.boards[mode].scrollTop;
  saveScroll(mode: Mode, value: number) { this.boards[mode].scrollTop = Math.max(0, value); }
  private patch(board: Session, values: Partial<BoardSnapshot>) {
    board.snapshot = { ...board.snapshot, ...values };
    this.listeners.forEach(listener => listener());
  }
  reset() {
    this.identity++;
    this.boards = { sprint: session(this.identity), survival: session(this.identity) };
    this.listeners.forEach(listener => listener());
  }
  invalidate(mode: Mode, entry?: LeaderboardEntry) {
    const board = this.boards[mode];
    board.listVersion++; board.personalVersion++;
    board.listRequest = undefined; board.personalRequest = undefined;
    board.personalUpdatedAt = entry ? Date.now() : Number.NEGATIVE_INFINITY;
    this.patch(board, { stale: true, loading: false, loadingMore: false, error: '', personalLoading: false, personalError: '',
      ...(entry ? { mine: entry, personalLoaded: true, personalError: '', personalRetryAt: 0 } : {}),
      revision: board.snapshot.revision + 1 });
  }
  async ensure(mode: Mode) {
    await Promise.all([this.load(mode), this.loadPersonal(mode)]);
  }
  async refresh(mode: Mode) {
    // Explicit refresh starts a new traversal; old rows remain until it succeeds.
    this.saveScroll(mode, 0);
    await Promise.all([this.load(mode, true), this.loadPersonal(mode, true)]);
  }
  load(mode: Mode, force = false): Promise<void> {
    const board = this.boards[mode];
    if (board.listRequest) return board.listRequest;
    const state = board.snapshot;
    if (Date.now() < state.retryAt || (!force && state.error)) return Promise.resolve();
    const expired = state.loaded && Date.now() - board.updatedAt >= BOARD_CACHE_MS;
    if (!force && state.loaded && !state.stale && !expired) return Promise.resolve();
    if (!force && state.loaded && board.scrollTop > BOARD_BOTTOM_MARGIN) {
      if (!state.stale) this.patch(board, { stale: true });
      return Promise.resolve();
    }
    return this.readPage(mode, board);
  }
  more(mode: Mode, automatic = false): Promise<void> {
    const board = this.boards[mode];
    if (board.listRequest) return board.listRequest;
    const state = board.snapshot;
    if (!state.loaded || !state.hasMore || !state.cursor || state.stale
      || Date.now() < state.retryAt || (automatic && state.error)) return Promise.resolve();
    if (Date.now() - board.updatedAt >= BOARD_CACHE_MS) {
      this.patch(board, { stale: true });
      return Promise.resolve();
    }
    return this.readPage(mode, board, state.cursor);
  }
  private readPage(mode: Mode, board: Session, cursor?: string): Promise<void> {
    const identity = this.identity;
    const version = ++board.listVersion;
    const valid = () => identity === this.identity && version === board.listVersion;
    // Defer the port until listRequest is assigned, including synchronous ports.
    const pending = Promise.resolve().then(() => this.ports.list(mode, cursor)).then(page => {
      if (!valid()) return;
      const combined = new Map((cursor ? board.snapshot.entries : []).map(entry => [entry.appUserId, entry]));
      const before = combined.size;
      for (const entry of page.entries) combined.set(entry.appUserId, entry);
      if (page.hasMore && (!page.cursor || page.cursor === cursor || (cursor && board.cursors.has(page.cursor))
        || combined.size === before)) throw { code: 'PAGINATION_STALLED' };
      if (!cursor) { board.cursors.clear(); board.updatedAt = Date.now(); }
      board.cursors.add(cursor ?? '');
      this.patch(board, { entries: [...combined.values()], cursor: page.hasMore ? page.cursor : undefined,
        hasMore: page.hasMore, loaded: true, stale: false, error: '', retryAt: 0 });
    }).catch(error => {
      if (!valid()) return;
      const issue = leaderboardError(error, 'list');
      this.patch(board, { error: issue.code === 'PAGINATION_STALLED' ? '榜单分页暂未推进，请刷新后重试。' : issue.message,
        retryAt: issue.retryAfterMs ? Date.now() + issue.retryAfterMs : 0 });
    }).finally(() => {
      if (!valid()) return;
      board.listRequest = undefined;
      this.patch(board, { loading: false, loadingMore: false });
    });
    board.listRequest = pending;
    this.patch(board, { loading: !cursor, loadingMore: Boolean(cursor), error: '' });
    return pending;
  }
  loadPersonal(mode: Mode, force = false): Promise<void> {
    const board = this.boards[mode];
    if (board.personalRequest) return board.personalRequest;
    const state = board.snapshot;
    if (Date.now() < state.personalRetryAt || (!force && state.personalError)
      || (!force && state.personalLoaded && Date.now() - board.personalUpdatedAt < BOARD_CACHE_MS)) return Promise.resolve();
    const identity = this.identity;
    const version = ++board.personalVersion;
    const valid = () => identity === this.identity && version === board.personalVersion;
    const pending = Promise.resolve().then(() => Promise.all([
      this.ports.personal(mode), this.ports.player().catch(() => undefined),
    ])).then(([mine, current]) => {
      if (!valid()) return;
      board.personalUpdatedAt = Date.now();
      this.patch(board, { mine, current, personalLoaded: true, personalError: '', personalRetryAt: 0 });
    }).catch(error => {
      if (!valid()) return;
      const issue = leaderboardError(error, 'personal');
      this.patch(board, { personalError: issue.message,
        personalRetryAt: issue.retryAfterMs ? Date.now() + issue.retryAfterMs : 0 });
    }).finally(() => {
      if (!valid()) return;
      board.personalRequest = undefined;
      this.patch(board, { personalLoading: false });
    });
    board.personalRequest = pending;
    this.patch(board, { personalLoading: true, personalError: '' });
    return pending;
  }
  // Exposed for lifecycle integration without fetching inactive modes.
  expire() {
    for (const mode of MODES) {
      const board = this.boards[mode];
      if (board.snapshot.loaded && Date.now() - board.updatedAt >= BOARD_CACHE_MS && !board.snapshot.stale) {
        this.patch(board, { stale: true });
      }
    }
  }
}
