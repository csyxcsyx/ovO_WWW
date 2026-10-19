import { describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry } from '@heybox/hb-sdk';
import { ProfileDirectory } from './profileDirectory';
const profile = {nickname:'盒友',avatar:'https://example.com/a.jpg'};
const row = (appUserId: string, score = 10, data = profile): LeaderboardEntry => ({appUserId,score,rank:1,ranked:true,createdAt:1,updatedAt:1,extra:{version:1,playerProfile:data}});
function ports() { return {current:vi.fn(),submit:vi.fn(),list:vi.fn()}; }
describe('independent public profile directory', () => {
  it('registers and updates a profile without changing either game board', async () => {
    const api = ports(); const previousScore = Date.now()+1000; api.current.mockResolvedValue(row('me',previousScore,{...profile,nickname:'旧名字'}));
    api.submit.mockImplementation(async (score, data) => row('me',score,data));
    const directory = new ProfileDirectory(api);
    await directory.syncOwn({appUserId:'me',profile}); await directory.syncOwn({appUserId:'me',profile});
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.submit.mock.calls[0][0]).toBe(previousScore + 1);
    expect(api.submit.mock.calls[0][1]).toEqual(profile);
  });
  it('avoids rewriting unchanged profiles and rejects data from a different account', async () => {
    const api = ports(); api.current.mockResolvedValue(row('me'));
    const directory = new ProfileDirectory(api);
    await directory.syncOwn({appUserId:'me',profile}); expect(api.submit).not.toHaveBeenCalled();
    directory.reset(); api.current.mockResolvedValue(row('other'));
    await expect(directory.syncOwn({appUserId:'me',profile})).rejects.toMatchObject({code:'AUTHORIZATION_CONTEXT_CHANGED'});
    expect(api.submit).not.toHaveBeenCalled();
  });
  it('shares pagination across modes and stops when requested players are found', async () => {
    const api = ports(); api.list.mockImplementation(async cursor => cursor ? {entries:[row('b')],hasMore:true,cursor:'third'} : {entries:[row('a')],hasMore:true,cursor:'opaque'});
    const directory = new ProfileDirectory(api);
    const [first,second] = await Promise.all([directory.resolve(['a','b']),directory.resolve(['b'])]);
    expect(first.size).toBe(2); expect(second.get('b')).toEqual(profile);
    expect(api.list.mock.calls.map(call=>call[0])).toEqual([undefined,'opaque']);
    await directory.resolve(['a']); expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('stops on rate limits, can retry later and does not discard other public records', async () => {
    const api = ports(); api.list.mockRejectedValueOnce({code:'RATE_LIMITED'}).mockResolvedValue({entries:[row('a')],hasMore:false});
    const directory = new ProfileDirectory(api);
    await expect(directory.resolve(['a'])).rejects.toMatchObject({code:'RATE_LIMITED'});
    expect(api.list).toHaveBeenCalledTimes(1);
    expect((await directory.resolve(['a'])).get('a')).toEqual(profile);
    expect((await directory.resolve(['missing'])).size).toBe(0);
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('invalidates account-bound in-flight reads without submitting the old profile', async () => {
    const api = ports(); let finish!: (value: LeaderboardEntry | undefined) => void;
    api.current.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const directory = new ProfileDirectory(api);
    const pending = directory.syncOwn({appUserId:'me',profile});
    directory.reset(); finish(undefined); await pending;
    expect(api.submit).not.toHaveBeenCalled();
  });
  it('does not accept repeated cursors or malformed empty pagination', async () => {
    const api = ports(); api.list.mockResolvedValue({entries:[],hasMore:true,cursor:'repeat'});
    await expect(new ProfileDirectory(api).resolve(['a'])).rejects.toMatchObject({code:'INVALID_RESPONSE'});
    expect(api.list).toHaveBeenCalledTimes(2);
  });
});
