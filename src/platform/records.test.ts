import { describe, expect, it } from 'vitest';
import { addResult, emptyData, mergeSavedData, parseSavedData, recordResult } from './records';
import { friendlyError, leaderboardError } from './errors';
import type { GameResult } from '../game/types';
const result = (id: number, score = id): GameResult => ({ id: String(id), mode: 'sprint', score, correct: 1, total: 2, maxStreak: 1, durationMs: 60000, finishedAt: id, history: [] });
describe('bounded personal records', () => {
  it('atomically identifies only the first positive score and later improvements as new records', () => {
    const zero = recordResult(emptyData(), result(0, 0));
    expect(zero.isNewBest).toBe(false);
    const first = recordResult(zero.data, result(1, 100));
    expect(first.isNewBest).toBe(true);
    expect(recordResult(first.data, result(1, 100)).added).toBe(false);
    expect(recordResult(first.data, result(2, 100)).isNewBest).toBe(false);
    expect(recordResult(first.data, result(3, 50)).isNewBest).toBe(false);
    expect(recordResult(first.data, result(4, 200)).isNewBest).toBe(true);
  });
  it('defaults safely for absent, corrupt or incompatible data', () => {
    for (const value of [undefined, null, 'oops', {}, {version:2}]) expect(parseSavedData(value)).toEqual(emptyData());
  });
  it('rejects invalid score and summary structures', () => {
    const data = parseSavedData({ version:1, mode:'survival', best: { sprint:NaN, survival:4 }, recent:[null, result(1), {...result(2), correct:9}, {...result(3), score:-1}] });
    expect(data.best).toEqual({sprint:0,survival:4}); expect(data.recent).toHaveLength(1); expect(data.mode).toBe('survival');
  });
  it('deduplicates repeated saves and never lowers best score', () => {
    let data = addResult(emptyData(), result(1, 100));
    data = addResult(data, result(1,100)); data = addResult(data,result(2,50));
    expect(data.recent).toHaveLength(2); expect(data.best.sprint).toBe(100);
  });
  it('stores only 20 summaries without full answer history', () => {
    let data = emptyData(); for(let i=0;i<30;i++) data=addResult(data,result(i));
    expect(data.recent).toHaveLength(20); expect(data.recent[0].id).toBe('29'); expect('history' in data.recent[0]).toBe(false);
  });
  it('merges asynchronous host loading with a newly completed local result', () => {
    const host = addResult(emptyData(),result(1,300)); const local = addResult(emptyData(),result(2,500));
    const merged = mergeSavedData(local,host);
    expect(merged.best.sprint).toBe(500); expect(merged.recent.map(r=>r.id)).toEqual(['2','1']);
  });
});
describe('recoverable platform failures', () => {
  it('does not describe a public leaderboard failure as a login requirement', () => {
    expect(leaderboardError({code:'UNAUTHORIZED'}, 'list').message).not.toContain('登录');
    expect(leaderboardError({code:'UNAUTHORIZED'}, 'personal').message).toContain('登录状态');
  });
  it('distinguishes authentication, missing boards and unsupported clients', () => {
    expect(friendlyError({code:'UNAUTHORIZED'}).message).toContain('登录');
    expect(friendlyError({code:'LEADERBOARD_NOT_FOUND'}).message).toContain('尚未开通');
    expect(friendlyError({code:'METHOD_FORBIDDEN'}).message).toContain('暂不支持');
  });
  it('backs off rate limits and does not expose raw private errors', () => {
    expect(friendlyError({code:'RATE_LIMITED',data:{retryAfterMs:90000}}).retryAfterMs).toBe(90000);
    expect(friendlyError({code:'RATE_LIMITED_BY_RUNTIME'}).retryAfterMs).toBe(60000);
    expect(friendlyError(new Error('secret-token')).message).not.toContain('secret');
  });
});
