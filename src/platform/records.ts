import type { GameResult, Mode } from '../game/types';
export type ResultSummary = Omit<GameResult, 'history'>;
export interface SavedData { version: 1; mode: Mode; best: Record<Mode, number>; recent: ResultSummary[] }
export const emptyData = (): SavedData => ({ version: 1, mode: 'sprint', best: { sprint: 0, survival: 0 }, recent: [] });
function finiteScore(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
export function parseSavedData(value: unknown): SavedData {
  if (!value || typeof value !== 'object') return emptyData();
  const candidate = value as Partial<SavedData>;
  if (candidate.version !== 1) return emptyData();
  const data = emptyData();
  if (candidate.mode === 'survival') data.mode = 'survival';
  for (const mode of ['sprint', 'survival'] as const) if (finiteScore(candidate.best?.[mode])) data.best[mode] = candidate.best[mode];
  if (Array.isArray(candidate.recent)) data.recent = candidate.recent.filter((r): r is ResultSummary =>
    Boolean(r && typeof r.id === 'string' && (r.mode === 'sprint' || r.mode === 'survival') && finiteScore(r.score) && finiteScore(r.correct) && finiteScore(r.total) && r.correct <= r.total && finiteScore(r.maxStreak) && r.maxStreak <= r.correct && finiteScore(r.durationMs) && finiteScore(r.finishedAt))).slice(0, 20);
  return data;
}
export function addResult(data: SavedData, result: GameResult): SavedData {
  const { history: _history, ...summary } = result;
  return { ...data, best: { ...data.best, [result.mode]: Math.max(data.best[result.mode], result.score) },
    recent: [summary, ...data.recent.filter(r => r.id !== result.id)].slice(0, 20) };
}
export function recordResult(data: SavedData, result: GameResult) {
  if (data.recent.some(item => item.id === result.id)) return { data, isNewBest: false, added: false };
  return { data: addResult(data, result), isNewBest: result.score > data.best[result.mode], added: true };
}
export function mergeSavedData(local: SavedData, host: SavedData): SavedData {
  const recent = [...new Map([...host.recent, ...local.recent].map(r => [r.id, r])).values()].sort((a,b) => b.finishedAt - a.finishedAt).slice(0,20);
  return { version: 1, mode: local.mode, best: { sprint: Math.max(local.best.sprint, host.best.sprint), survival: Math.max(local.best.survival, host.best.survival) }, recent };
}
export const LOCAL_KEY = 'official_inspector_v1';
export function loadLocalData(): SavedData {
  try { return parseSavedData(JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null')); } catch { return emptyData(); }
}
export function persistLocalData(data: SavedData) { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }
