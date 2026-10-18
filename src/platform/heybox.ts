import hbSDK, { type LeaderboardEntry, type MiniProgramSDKHandshakeState } from '@heybox/hb-sdk';
import type { GameResult, Mode } from '../game/types';
import { friendlyError, isUnsupported } from './errors';

export type { LeaderboardEntry, MiniProgramSDKHandshakeState };
export const BOARD_KEYS: Record<Mode, string> = { sprint: 'official_sprint_v1', survival: 'official_survival_v1' };
export const getHandshake = () => hbSDK.getHandshakeState();
export const subscribeHandshake = (handler: (state: MiniProgramSDKHandshakeState) => void) => hbSDK.onHandshakeStateChange(handler);
export const subscribeUnload = (handler: () => void) => hbSDK.on('unload', handler);
const pendingReads = new Map<string, Promise<unknown>>();
let nextCloudAttempt = 0;
async function cloudCall<T>(load: () => Promise<T>): Promise<T> {
  if (Date.now() < nextCloudAttempt) throw { code: 'RATE_LIMITED_BY_RUNTIME', data: { retryAfterMs: nextCloudAttempt - Date.now() } };
  try { return await load(); }
  catch (error) { const issue = friendlyError(error); if (issue.retryAfterMs) nextCloudAttempt = Date.now() + issue.retryAfterMs; throw error; }
}
function sharedRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = pendingReads.get(key);
  if (existing) return existing as Promise<T>;
  const pending = cloudCall(load).finally(() => pendingReads.delete(key));
  pendingReads.set(key, pending); return pending;
}
let unloaded = false;
hbSDK.on('unload', () => { unloaded = true; });
function requireHost() {
  if (unloaded) throw { code: 'RUNTIME_UNLOADED' };
  if (hbSDK.getHandshakeState().status !== 'ready') throw { code: 'LOCAL_PREVIEW' };
}
export async function readHostStorage(): Promise<unknown> {
  requireHost();
  return (await hbSDK.storage.getStorage({ key: 'official_inspector_v1' })).data;
}
export async function writeHostStorage(data: unknown) {
  requireHost();
  await hbSDK.storage.setStorage({ key: 'official_inspector_v1', data });
}
export async function getBoard(mode: Mode, cursor?: string) {
  requireHost();
  return sharedRead(`list-${mode}-${cursor ?? ''}`, () => hbSDK.cloud.leaderboard.getList({ key: BOARD_KEYS[mode], limit: 20, ...(cursor ? { cursor } : {}) }));
}
export async function getMyEntry(mode: Mode) {
  requireHost();
  return sharedRead(`current-${mode}`, () => hbSDK.cloud.leaderboard.getCurrentUserEntry({ key: BOARD_KEYS[mode] }));
}
export async function submitResult(result: GameResult) {
  requireHost();
  return cloudCall(() => hbSDK.cloud.leaderboard.submit({ key: BOARD_KEYS[result.mode], score: result.score,
    extra: { correct: result.correct, total: result.total, maxStreak: result.maxStreak, rules: 1 } }));
}
export async function copyGameLink(mode: Mode) {
  requireHost();
  return hbSDK.share.copyLink({ extra: { page: 'home', mode } });
}
export function getSharedMode(): Mode | undefined {
  try {
    const extra = hbSDK.share.getExtra();
    if (extra && typeof extra === 'object' && !Array.isArray(extra) && 'mode' in extra && (extra.mode === 'sprint' || extra.mode === 'survival')) return extra.mode;
  } catch { /* 无有效分享状态时使用首页默认模式。 */ }
}
export async function shareResult(mode: Mode, region: HTMLElement): Promise<'screenshot' | 'link'> {
  requireHost();
  const rect = region.getBoundingClientRect();
  // 仅在成绩单完整位于可见窗口时截取；小屏及分享能力缺失时提供通用链接。
  if (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) {
    await copyGameLink(mode); return 'link';
  }
  try {
    await hbSDK.share.screenshot({ rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      watermarkTheme: 'light', delay: 100, saveToAlbum: true });
    return 'screenshot';
  } catch (error) {
    if (!isUnsupported(error)) throw error;
    await copyGameLink(mode); return 'link';
  }
}
export function subscribeVisibility(callback: (visible: boolean) => void) {
  const stopShow = hbSDK.on('show', () => callback(true));
  const stopHide = hbSDK.on('hide', () => callback(false));
  return () => { stopShow(); stopHide(); };
}
export function subscribeLogin(callback: () => void) { return hbSDK.on('heybox_app_login_change', callback); }
export async function initializeViewport() {
  requireHost();
  const apply = (info: Awaited<ReturnType<typeof hbSDK.viewport.getWindowInfo>>) => {
    const insets = { top: info.safeArea.top, right: Math.max(0, info.windowWidth - info.safeArea.right),
      bottom: Math.max(0, info.windowHeight - info.safeArea.bottom), left: info.safeArea.left };
    for (const [key, value] of Object.entries(insets)) document.documentElement.style.setProperty(`--host-safe-${key}`, `${value}px`);
  };
  const stop = hbSDK.on('viewport_change', apply);
  try { apply(await hbSDK.viewport.getWindowInfo()); } catch { /* CSS env() 继续负责避让。 */ }
  return stop;
}
