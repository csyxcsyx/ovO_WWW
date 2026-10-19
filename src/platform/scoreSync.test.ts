import { describe, expect, it, vi } from 'vitest';
import { ScoreSync } from './scoreSync';
import type { GameResult, Mode } from '../game/types';
import type { LeaderboardEntry } from './heybox';

const result = (score: number, mode: Mode = 'sprint', id = `${mode}-${score}`): GameResult =>
  ({id,mode,score,correct:1,total:2,maxStreak:1,durationMs:1000,finishedAt:1000,history:[]});
const entry = (score: number) => ({score,ranked:false,rank:0,appUserId:'test-user',extra:{}} as LeaderboardEntry);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve=yes; reject=no; });
  return {promise, resolve, reject};
}
describe('session score synchronization', () => {
  it('keeps the candidate when a malformed descending-board response loses its score', async () => {
    const submit = vi.fn().mockResolvedValue(entry(2)); const sync = new ScoreSync(submit);
    sync.setReady(true); sync.enqueue(result(5,'survival'));
    await vi.waitFor(()=>expect(sync.getSnapshot().survival?.status).toBe('error'));
    expect(sync.exportPending()[0].candidate.score).toBe(5);
  });
  it('retries the retained higher score when a later survival run ties or scores lower', async () => {
    const submit = vi.fn().mockRejectedValueOnce({code:'REQUEST_FAILED'}).mockResolvedValue(entry(9));
    const sync = new ScoreSync(submit); sync.setReady(true);
    sync.enqueue(result(9,'survival','failed'));
    await vi.waitFor(()=>expect(sync.getSnapshot().survival?.status).toBe('error'));
    sync.enqueue(result(3,'survival','later-run'));
    await vi.waitFor(()=>expect(sync.getSnapshot().survival?.status).toBe('synced'));
    expect(submit.mock.calls.map(call=>call[0].score)).toEqual([9,9]);
    expect(sync.getSnapshot().survival?.resultId).toBe('later-run');
  });
  it('marks lower or tied runs covered only after the platform has confirmed a best', async () => {
    const submit = vi.fn().mockResolvedValue(entry(9));
    const sync = new ScoreSync(submit); sync.setReady(true); sync.enqueue(result(3,'survival','first'));
    await vi.waitFor(()=>expect(sync.getSnapshot().survival?.status).toBe('synced'));
    sync.enqueue(result(2,'survival','next')); sync.enqueue(result(9,'survival','tie'));
    expect(submit).toHaveBeenCalledTimes(1); expect(sync.getSnapshot().survival?.resultId).toBe('tie');
  });
  it('waits for the bridge and deduplicates repeat completion effects', async () => {
    const submit = vi.fn().mockResolvedValue(entry(100));
    const sync = new ScoreSync(submit);
    sync.enqueue(result(100)); sync.enqueue(result(100));
    expect(submit).not.toHaveBeenCalled();
    sync.setReady(true);
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('synced'));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(sync.getSnapshot().sprint?.entry?.score).toBe(100);
  });
  it('serializes a mode, coalesces waiting scores and keeps the two modes independent', async () => {
    const first = deferred<LeaderboardEntry>();
    const submit = vi.fn().mockImplementationOnce(() => first.promise).mockImplementation(async (game: GameResult) => entry(game.score));
    const sync = new ScoreSync(submit); sync.setReady(true);
    sync.enqueue(result(100)); sync.enqueue(result(200)); sync.enqueue(result(300));
    sync.enqueue(result(4,'survival'));
    expect(submit.mock.calls.map(call => call[0].score)).toEqual([100,4]);
    first.resolve(entry(100));
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('synced'));
    expect(submit.mock.calls.map(call => call[0].score)).toEqual([100,4,300]);
  });
  it('uses the server best and does not resubmit candidates already covered by it', async () => {
    const request = deferred<LeaderboardEntry>();
    const submit = vi.fn(() => request.promise);
    const sync = new ScoreSync(submit); sync.setReady(true);
    sync.enqueue(result(100)); sync.enqueue(result(200));
    request.resolve(entry(900));
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.entry?.score).toBe(900));
    expect(sync.getSnapshot().sprint?.resultId).toBe('sprint-200');
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('retains a failed candidate for explicit retry without a request loop', async () => {
    const submit = vi.fn().mockRejectedValueOnce({code:'UNAUTHORIZED'}).mockResolvedValue(entry(100));
    const sync = new ScoreSync(submit); sync.setReady(true); sync.enqueue(result(100));
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('error'));
    sync.setReady(true);
    expect(submit).toHaveBeenCalledTimes(1);
    sync.retry('sprint');
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('synced'));
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it('honors cooldowns even when another new record is queued', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const submit = vi.fn().mockRejectedValueOnce({code:'RATE_LIMITED',data:{retryAfterMs:90000}}).mockResolvedValue(entry(300));
      const sync = new ScoreSync(submit); sync.setReady(true); sync.enqueue(result(100));
      await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('error'));
      sync.enqueue(result(300)); sync.retry('sprint'); sync.foreground();
      expect(submit).toHaveBeenCalledTimes(1);
      expect(sync.getSnapshot().sprint?.status).toBe('error');
      now.mockReturnValue(91001);
      sync.retry('sprint');
      await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('synced'));
      expect(submit).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
  });
  it('allows at most one foreground retry per failure chain', async () => {
    const submit = vi.fn().mockRejectedValue({code:'REQUEST_FAILED'});
    const sync = new ScoreSync(submit); sync.setReady(true); sync.enqueue(result(100));
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('error'));
    sync.foreground();
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.status).toBe('error'));
    sync.foreground(); sync.foreground();
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it('invalidates queued and in-flight old-account results', async () => {
    const request = deferred<LeaderboardEntry>();
    const submit = vi.fn().mockReturnValueOnce(request.promise).mockResolvedValue(entry(200));
    const sync = new ScoreSync(submit); sync.setReady(true);
    sync.enqueue(result(100)); sync.enqueue(result(150));
    sync.resetSession();
    sync.enqueue(result(200));
    request.resolve(entry(100));
    await vi.waitFor(() => expect(sync.getSnapshot().sprint?.entry?.score).toBe(200));
    expect(submit.mock.calls.map(call => call[0].score)).toEqual([100,200]);
    expect(sync.getSnapshot().sprint?.resultId).toBe('sprint-200');
  });
  it('never sends zero scores', () => {
    const submit = vi.fn();
    const sync = new ScoreSync(submit); sync.setReady(true); sync.enqueue(result(0));
    expect(submit).not.toHaveBeenCalled(); expect(sync.getSnapshot()).toEqual({});
  });
});
