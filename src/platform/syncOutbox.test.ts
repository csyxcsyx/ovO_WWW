import { describe, expect, it, vi } from 'vitest';
import { parseOutbox, SyncOutbox } from './syncOutbox';
import { ScoreSync } from './scoreSync';
import type { LeaderboardEntry } from './heybox';
import { parseCandidate } from './scoreCandidate';

const candidate = (score: number, mode: 'sprint' | 'survival' = 'survival') => ({ id: `${mode}-${score}`, mode, score });
const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
describe('account-owned durable score outbox', () => {
  it('restores a failed survival score after reopening, without importing another account', async () => {
    const disk = storage(); const outbox = new SyncOutbox(disk);
    const submit = vi.fn().mockRejectedValueOnce({code:'REQUEST_FAILED'});
    const first = new ScoreSync(submit, pending => outbox.save('account-a', pending));
    first.setReady(true); first.enqueue(candidate(7));
    await vi.waitFor(() => expect(first.getSnapshot().survival?.status).toBe('error'));
    const reopened = new SyncOutbox(disk);
    expect(reopened.get('account-b')).toEqual([]);
    const second = new ScoreSync(vi.fn().mockResolvedValue({score:7} as LeaderboardEntry), pending => reopened.save('account-a', pending));
    second.restore(reopened.get('account-a')); second.setReady(true);
    await vi.waitFor(() => expect(second.getSnapshot().survival?.status).toBe('synced'));
    expect(new SyncOutbox(disk).get('account-a')).toEqual([]);
  });
  it('retains only five accounts and the highest candidate per mode', () => {
    const data = parseOutbox({version:1,accounts:Array.from({length:8}, (_, index) => ({owner:`user-${index}`,touchedAt:index,pending:[{candidate:candidate(2),retryAt:100},{candidate:candidate(5),retryAt:200},{candidate:candidate(100,'sprint'),retryAt:0}]}))});
    expect(data.accounts).toHaveLength(5); expect(data.accounts[0].owner).toBe('user-7');
    expect(data.accounts[0].pending.map(item=>item.candidate.score)).toEqual([5,100]);
  });
  it('does not manufacture statistics for legacy best-only records', () => {
    expect(parseCandidate({id:'old',mode:'survival',score:9})).toEqual({id:'old',mode:'survival',score:9});
    expect(parseCandidate({id:'bad',mode:'survival',score:-1})).toBeUndefined();
    expect(parseOutbox({version:2,accounts:[]})).toEqual({version:1,accounts:[]});
    const disk = {getItem:()=>'{broken',setItem:()=>{throw new Error('quota');}};
    const outbox = new SyncOutbox(disk); expect(outbox.get('a')).toEqual([]);
    expect(()=>outbox.save('a',[{candidate:candidate(1),retryAt:0}])).toThrow('quota');
    expect(outbox.get('a')[0].candidate.score).toBe(1);
  });
  it('preserves a rate-limit deadline across reopening', () => {
    const submit = vi.fn(); const sync = new ScoreSync(submit);
    sync.restore([{candidate:candidate(8),retryAt:Date.now()+60_000}]); sync.setReady(true); sync.retry('survival');
    expect(submit).not.toHaveBeenCalled(); expect(sync.getSnapshot().survival?.status).toBe('error');
  });
});
