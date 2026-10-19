import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry } from '@heybox/hb-sdk';
import { BOARD_CACHE_MS, LeaderboardStore, type BoardPage } from './leaderboardStore';

const row = (appUserId: string, score = 100): LeaderboardEntry => ({ appUserId, score, rank: 1, ranked: true, createdAt: 1, updatedAt: 1, extra: {} });
const page = (ids: string[], cursor?: string): BoardPage => ({ entries: ids.map(id => row(id)), hasMore: Boolean(cursor), cursor });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const ports = { list: vi.fn().mockResolvedValue(page(['first'], 'next')), personal: vi.fn().mockResolvedValue(undefined), player: vi.fn().mockResolvedValue(undefined) };
  return { ports, store: new LeaderboardStore(ports) };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000); });
afterEach(() => vi.useRealTimers());

describe('leaderboard presentation cache and pagination', () => {
  it('keeps loaded pages and per-mode scroll positions across switches and reopening', async () => {
    const { store, ports } = setup();
    await store.ensure('sprint');
    ports.list.mockResolvedValueOnce(page(['second']));
    await store.more('sprint'); store.saveScroll('sprint', 600);
    await store.ensure('survival'); store.saveScroll('survival', 250);
    const snapshot = store.getSnapshot('sprint');
    await store.ensure('sprint');
    expect(store.getSnapshot('sprint')).toBe(snapshot);
    expect(snapshot.entries.map(entry => entry.appUserId)).toEqual(['first', 'second']);
    expect(store.getScroll('sprint')).toBe(600); expect(store.getScroll('survival')).toBe(250);
    expect(ports.list).toHaveBeenCalledTimes(3);
    expect(ports.personal).toHaveBeenCalledTimes(2);
  });
  it('merges concurrent reads and appends a cursor only once, deduplicating users', async () => {
    const { store, ports } = setup(); const first = deferred<BoardPage>();
    ports.list.mockReturnValueOnce(first.promise);
    const a = store.load('sprint'); const b = store.load('sprint');
    expect(a).toBe(b);
    first.resolve(page(['first', 'second'], 'opaque-one')); await a;
    const next = deferred<BoardPage>(); ports.list.mockReturnValueOnce(next.promise);
    const more = store.more('sprint', true);
    expect(store.more('sprint', true)).toBe(more);
    next.resolve(page(['second', 'third'], 'opaque-two')); await more;
    expect(ports.list.mock.calls).toEqual([['sprint', undefined], ['sprint', 'opaque-one']]);
    expect(store.getSnapshot('sprint').entries.map(entry => entry.appUserId)).toEqual(['first', 'second', 'third']);
  });
  it('uses hasMore rather than a short page to decide whether traversal is finished', async () => {
    const { store, ports } = setup(); await store.load('sprint');
    ports.list.mockResolvedValueOnce(page(['second'], 'third'));
    await store.more('sprint');
    expect(store.getSnapshot('sprint').hasMore).toBe(true);
    ports.list.mockResolvedValueOnce(page([])); await store.more('sprint');
    expect(store.getSnapshot('sprint').hasMore).toBe(false);
    await store.more('sprint'); expect(ports.list).toHaveBeenCalledTimes(3);
  });
  it.each([
    { entries: [row('second')], hasMore: true, cursor: 'next' },
    { entries: [], hasMore: true, cursor: 'third' },
    { entries: [row('first')], hasMore: true, cursor: 'third' },
    { entries: [row('second')], hasMore: true },
  ])('stops malformed or non-advancing pagination without discarding prior rows: %j', async broken => {
    const { store, ports } = setup(); await store.load('sprint');
    ports.list.mockResolvedValueOnce(broken);
    await store.more('sprint', true); await store.more('sprint', true);
    expect(ports.list).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot('sprint').entries.map(entry => entry.appUserId)).toEqual(['first']);
    expect(store.getSnapshot('sprint').error).toContain('分页暂未推进');
  });
  it('detects cursor cycles longer than one page', async () => {
    const { store, ports } = setup(); await store.load('sprint');
    ports.list.mockResolvedValueOnce(page(['second'], 'third')); await store.more('sprint');
    ports.list.mockResolvedValueOnce(page(['third'], 'next')); await store.more('sprint');
    expect(store.getSnapshot('sprint').error).toContain('分页暂未推进');
    expect(store.getSnapshot('sprint').entries).toHaveLength(2);
  });
  it('preserves rows after failure and requires an explicit retry rather than an observer loop', async () => {
    const { store, ports } = setup(); await store.load('sprint');
    ports.list.mockRejectedValueOnce({ code: 'REQUEST_FAILED' });
    await store.more('sprint', true); await store.more('sprint', true); await store.ensure('sprint');
    expect(ports.list).toHaveBeenCalledTimes(2);
    ports.list.mockResolvedValueOnce(page(['second'])); await store.more('sprint');
    expect(store.getSnapshot('sprint').entries).toHaveLength(2);
    expect(store.getSnapshot('sprint').error).toBe('');
  });
  it('honors rate-limit deadlines even for manual refresh or retry', async () => {
    const { store, ports } = setup(); await store.load('sprint');
    ports.list.mockRejectedValueOnce({ code: 'RATE_LIMITED', data: { retryAfterMs: 45000 } });
    await store.more('sprint');
    expect(store.getSnapshot('sprint').retryAt).toBe(46000);
    await store.refresh('sprint'); await store.more('sprint');
    expect(ports.list).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(45000);
    ports.list.mockResolvedValueOnce(page(['second'])); await store.more('sprint');
    expect(store.getSnapshot('sprint').entries).toHaveLength(2);
  });
  it('keeps the cached screen while refreshing an expired first page', async () => {
    const { store, ports } = setup(); await store.load('sprint');
    vi.advanceTimersByTime(BOARD_CACHE_MS);
    const fresh = deferred<BoardPage>(); ports.list.mockReturnValueOnce(fresh.promise);
    const request = store.load('sprint');
    expect(store.getSnapshot('sprint')).toMatchObject({ loaded: true, loading: true, entries: [row('first')] });
    fresh.resolve(page(['fresh'])); await request;
    expect(store.getSnapshot('sprint').entries).toEqual([row('fresh')]);
  });
  it('defers an expired deep list until explicit refresh and keeps its scroll position', async () => {
    const { store, ports } = setup(); await store.load('sprint');
    store.saveScroll('sprint', 800); vi.advanceTimersByTime(BOARD_CACHE_MS);
    await store.ensure('sprint'); await store.more('sprint');
    expect(store.getSnapshot('sprint').stale).toBe(true);
    expect(store.getScroll('sprint')).toBe(800); expect(ports.list).toHaveBeenCalledTimes(1);
    ports.list.mockResolvedValueOnce(page(['fresh'])); await store.refresh('sprint');
    expect(store.getScroll('sprint')).toBe(0); expect(store.getSnapshot('sprint').entries).toEqual([row('fresh')]);
  });
  it('keeps an independent public list when identity is denied or personal reads are slow', async () => {
    const { store, ports } = setup(); const mine = deferred<LeaderboardEntry | undefined>();
    ports.personal.mockReturnValueOnce(mine.promise);
    const pending = store.ensure('sprint');
    await store.load('sprint');
    expect(store.getSnapshot('sprint').loaded).toBe(true);
    mine.reject({ code: 'UNAUTHORIZED' }); await pending;
    expect(store.getSnapshot('sprint').personalError).toContain('登录状态');
    expect(store.getSnapshot('sprint').error).toBe('');
  });
  it('updates the submitted best immediately while a deep list stays visible', async () => {
    const { store, ports } = setup(); await store.ensure('sprint');
    store.saveScroll('sprint', 700);
    const best = row('me', 900); store.invalidate('sprint', best);
    await store.ensure('sprint');
    expect(store.getSnapshot('sprint')).toMatchObject({ mine: best, personalLoaded: true, stale: true, entries: [row('first')] });
    expect(ports.list).toHaveBeenCalledTimes(1); expect(ports.personal).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot('survival').stale).toBe(false);
  });
  it('ignores an old page and its cleanup after invalidation starts a fresh request', async () => {
    const { store, ports } = setup(); const old = deferred<BoardPage>(); const fresh = deferred<BoardPage>();
    ports.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = store.load('sprint'); await Promise.resolve();
    store.invalidate('sprint', row('me', 900));
    const second = store.load('sprint'); await Promise.resolve();
    old.resolve(page(['old'])); await first;
    expect(store.getSnapshot('sprint').loading).toBe(true);
    fresh.resolve(page(['fresh'])); await second;
    expect(store.getSnapshot('sprint').entries).toEqual([row('fresh')]);
  });
  it('clears pages, personal state and scroll and discards all pre-account-change responses', async () => {
    const { store, ports } = setup(); const list = deferred<BoardPage>(); const personal = deferred<LeaderboardEntry | undefined>();
    ports.list.mockReturnValueOnce(list.promise); ports.personal.mockReturnValueOnce(personal.promise);
    const pending = store.ensure('sprint'); await Promise.resolve();
    store.saveScroll('sprint', 500); store.reset();
    list.resolve(page(['old'])); personal.resolve(row('old-me')); await pending;
    expect(store.getScroll('sprint')).toBe(0);
    expect(store.getSnapshot('sprint')).toMatchObject({ entries: [], identity: 1, loaded: false });
    expect(store.getSnapshot('sprint').mine).toBeUndefined();
    expect(store.getSnapshot('sprint').current).toBeUndefined();
    await store.ensure('sprint');
    expect(store.getSnapshot('sprint').entries).toEqual([row('first')]);
  });
  it('retains loaded rows and personal data when a refresh fails', async () => {
    const { store, ports } = setup(); ports.personal.mockResolvedValueOnce(row('me'));
    await store.ensure('sprint');
    ports.list.mockRejectedValueOnce({ code: 'REQUEST_FAILED' }); ports.personal.mockRejectedValueOnce({ code: 'REQUEST_FAILED' });
    await store.refresh('sprint');
    expect(store.getSnapshot('sprint')).toMatchObject({ loaded: true, entries: [row('first')], mine: row('me'), personalLoaded: true });
    expect(store.getSnapshot('sprint').error).not.toBe('');
  });
  it('reloads an invalidated personal entry when the invalidation has no entry payload', async () => {
    const { store, ports } = setup(); await store.ensure('sprint');
    ports.personal.mockResolvedValueOnce(row('me', 900)); store.invalidate('sprint');
    await store.ensure('sprint');
    expect(store.getSnapshot('sprint').mine?.score).toBe(900);
    expect(ports.personal).toHaveBeenCalledTimes(2);
  });
  it('revalidates after a score submission even when an earlier list request failed', async () => {
    const { store, ports } = setup(); ports.list.mockRejectedValueOnce({ code: 'REQUEST_FAILED' });
    await store.ensure('sprint'); store.invalidate('sprint', row('me', 900));
    await store.ensure('sprint');
    expect(store.getSnapshot('sprint')).toMatchObject({ error: '', loaded: true, mine: row('me', 900) });
    expect(ports.list).toHaveBeenCalledTimes(2);
  });
  it('does not notify React on every scroll or mix the two modes during concurrent requests', async () => {
    const { store, ports } = setup(); const sprint = deferred<BoardPage>(); const survival = deferred<BoardPage>();
    ports.list.mockImplementation(mode => mode === 'sprint' ? sprint.promise : survival.promise);
    const a = store.load('sprint'); const b = store.load('survival');
    const listener = vi.fn(); store.subscribe(listener); store.saveScroll('sprint', 300);
    expect(listener).not.toHaveBeenCalled();
    survival.resolve(page(['survivor'])); await b; sprint.resolve(page(['sprinter'])); await a;
    expect(store.getSnapshot('sprint').entries[0].appUserId).toBe('sprinter');
    expect(store.getSnapshot('survival').entries[0].appUserId).toBe('survivor');
  });
});
