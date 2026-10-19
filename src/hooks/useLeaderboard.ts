import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import type { Mode } from '../game/types';
import { leaderboards } from '../platform/leaderboards';
import { BOARD_BOTTOM_MARGIN, type LeaderboardStore } from '../platform/leaderboardStore';
import { subscribeVisibility } from '../platform/heybox';

export function useLeaderboard(mode: Mode, ready: boolean, scrollRef: RefObject<HTMLDivElement | null>, store: LeaderboardStore = leaderboards) {
  const read = useCallback(() => store.getSnapshot(mode), [mode, store]);
  const state = useSyncExternalStore(store.subscribe, read);
  const sentinel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let root: HTMLDivElement | null = null;
    let frame = 0;
    const save = () => { if (root) store.saveScroll(mode, root.scrollTop); };
    const connect = () => {
      root = scrollRef.current;
      if (!root) return;
      root.scrollTop = store.getScroll(mode);
      root.addEventListener('scroll', save, { passive: true });
    };
    // Parent host refs and Dialog.showModal() run after child layout effects.
    // Resolve the ref in the frame too, so the first mount/reopen also connects.
    if (scrollRef.current?.closest('dialog')?.open) connect();
    else frame = requestAnimationFrame(connect);
    return () => { cancelAnimationFrame(frame); root?.removeEventListener('scroll', save); };
  }, [mode, scrollRef, state.identity, store]);
  useEffect(() => { if (ready) void store.ensure(mode); }, [mode, ready, state.revision, state.identity, store]);
  useEffect(() => subscribeVisibility(visible => {
    if (visible && ready) { store.expire(); void store.ensure(mode); }
  }), [mode, ready, store]);
  useEffect(() => {
    const root = scrollRef.current;
    if (!ready || !root || !sentinel.current || !state.loaded || !state.hasMore || state.stale
      || state.loading || state.loadingMore || state.error || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void store.more(mode, true);
    }, { root, rootMargin: `0px 0px ${BOARD_BOTTOM_MARGIN}px 0px` });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [mode, ready, scrollRef, state.loaded, state.hasMore, state.cursor, state.stale, state.loading, state.loadingMore, state.error, store]);
  const refresh = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    void store.refresh(mode);
  };
  return { ...state, sentinel, refresh, more: () => { void store.more(mode); } };
}
