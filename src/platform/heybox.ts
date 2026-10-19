import hbSDK, { type LeaderboardEntry, type MiniProgramSDKHandshakeState } from '@heybox/hb-sdk';
import type { GameResult, Mode } from '../game/types';
import { friendlyError, isUnsupported } from './errors';
import { readPlayerProfile, type CurrentPlayer } from './playerProfile';

export type { LeaderboardEntry, MiniProgramSDKHandshakeState };
export const BOARD_KEYS: Record<Mode, string> = { sprint: 'official_sprint_v1', survival: 'official_survival_v1' };
export const getHandshake = () => hbSDK.getHandshakeState();
export const subscribeHandshake = (handler: (state: MiniProgramSDKHandshakeState) => void) => hbSDK.onHandshakeStateChange(handler);
export const subscribeUnload = (handler: () => void) => hbSDK.on('unload', handler);
const pendingReads = new Map<string, Promise<unknown>>();
const cloudCooldown = new Map<string, number>();
const boardRevisions: Record<Mode, number> = { sprint: 0, survival: 0 };
const boardListeners = new Set<(mode?: Mode) => void>();
export const subscribeBoardChange = (listener: (mode?: Mode) => void) => { boardListeners.add(listener); return () => { boardListeners.delete(listener); }; };
function invalidateBoard(mode?: Mode) {
  for (const key of mode ? [mode] : ['sprint', 'survival'] as const) boardRevisions[key]++;
  boardListeners.forEach(listener => listener(mode));
}
let identityRevision = 0;
let profileRequest: Promise<CurrentPlayer | undefined> | undefined;
let profileExpires = 0;
hbSDK.on('heybox_app_login_change', () => {
  identityRevision++; profileRequest = undefined; profileExpires = 0;
  invalidateBoard();
});
async function cloudCall<T>(scope: string, load: () => Promise<T>): Promise<T> {
  const retryAt = Math.max(cloudCooldown.get(scope) ?? 0, cloudCooldown.get('runtime') ?? 0);
  if (Date.now() < retryAt) throw { code: 'RATE_LIMITED_BY_RUNTIME', data: { retryAfterMs: retryAt - Date.now() } };
  try { return await load(); }
  catch (error) {
    const issue = friendlyError(error);
    const origin = (error as { data?: { origin?: string } } | null)?.data?.origin;
    if (issue.retryAfterMs) cloudCooldown.set(issue.code === 'RATE_LIMITED_BY_RUNTIME' && origin === 'budget' ? 'runtime' : scope, Date.now() + issue.retryAfterMs);
    console.warn('[官网鉴定局] 排行榜请求失败', { operation: scope, code: issue.code });
    throw error;
  }
}
function sharedRead<T>(key: string, scope: string, load: () => Promise<T>): Promise<T> {
  const existing = pendingReads.get(key);
  if (existing) return existing as Promise<T>;
  const pending = cloudCall(scope, load).finally(() => { if (pendingReads.get(key) === pending) pendingReads.delete(key); });
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
  return sharedRead(`list-${mode}-${boardRevisions[mode]}-${cursor ?? ''}`, `list:${mode}`, () => hbSDK.cloud.leaderboard.getList({ key: BOARD_KEYS[mode], limit: 20, ...(cursor ? { cursor } : {}) }));
}
export async function getMyEntry(mode: Mode) {
  requireHost();
  return sharedRead(`current-${mode}-${boardRevisions[mode]}`, `personal:${mode}`, () => hbSDK.cloud.leaderboard.getCurrentUserEntry({ key: BOARD_KEYS[mode] }));
}
export async function getCurrentPlayer(): Promise<CurrentPlayer | undefined> {
  requireHost();
  if (profileRequest && Date.now() < profileExpires) return profileRequest;
  const revision = identityRevision;
  profileExpires = Date.now() + 60_000;
  // Optional display data, never a gate for reading/submitting scores.
  profileRequest = cloudCall('profile', () => hbSDK.user.getInfo()).then(result => {
    if (revision !== identityRevision) throw { code: 'AUTHORIZATION_CONTEXT_CHANGED' };
    if (!result.isHeyboxAppLoggedIn || !result.userInfo) return;
    const info = result.userInfo;
    const profile = result.authorization.profile === 'granted' ? readPlayerProfile(info.profile) : undefined;
    return { appUserId: info.app_user_id, profile: profile ?? { nickname: '', avatar: '' } };
  }).catch(() => undefined);
  return profileRequest;
}
export async function submitResult(result: GameResult) {
  requireHost();
  const revision = identityRevision;
  const player = await getCurrentPlayer();
  // A profile read introduces an await before submit; do not transfer a score
  // queued by the previous account to the newly logged-in account.
  if (revision !== identityRevision) throw { code: 'AUTHORIZATION_CONTEXT_CHANGED' };
  requireHost();
  const entry = await cloudCall(`submit:${result.mode}`, () => hbSDK.cloud.leaderboard.submit({ key: BOARD_KEYS[result.mode], score: result.score,
    extra: { correct: result.correct, total: result.total, maxStreak: result.maxStreak, rules: 1,
      ...(player && (player.profile.nickname || player.profile.avatar) ? { playerProfile: player.profile } : {}) } }));
  invalidateBoard(result.mode);
  return entry;
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
  // A receipt inside a short screen's scroll pane may be clipped even when its
  // full DOM rect is inside the window. Never capture controls in its place.
  let clipped = false;
  for (let parent = region.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (rect.top < bounds.top || rect.bottom > bounds.bottom)) clipped = true;
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (rect.left < bounds.left || rect.right > bounds.right)) clipped = true;
  }
  // 仅在成绩单完整位于可见窗口时截取；小屏及分享能力缺失时提供通用链接。
  if (clipped || rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) {
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
    if (info.windowHeight > 0) document.documentElement.style.setProperty('--host-window-height', `${info.windowHeight}px`);
    const insets = { top: info.safeArea.top, right: Math.max(0, info.windowWidth - info.safeArea.right),
      bottom: Math.max(0, info.windowHeight - info.safeArea.bottom), left: info.safeArea.left };
    for (const [key, value] of Object.entries(insets)) document.documentElement.style.setProperty(`--host-safe-${key}`, `${value}px`);
  };
  const stop = hbSDK.on('viewport_change', apply);
  const stopShow = hbSDK.on('show', () => { void hbSDK.viewport.getWindowInfo().then(apply).catch(() => {}); });
  try { apply(await hbSDK.viewport.getWindowInfo()); } catch { /* CSS env() 继续负责避让。 */ }
  return () => { stop(); stopShow(); };
}
