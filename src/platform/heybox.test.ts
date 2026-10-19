import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  getHandshakeState: vi.fn(() => ({status:'ready'})), on: vi.fn((_event: string, _handler: () => void) => () => {}),
  cloud: { leaderboard: { getList:vi.fn(), getCurrentUserEntry:vi.fn(), submit:vi.fn() } },
  share: { copyLink:vi.fn(), screenshot:vi.fn(), getExtra:vi.fn() },
  storage: { getStorage:vi.fn(), setStorage:vi.fn() },
  user: { getInfo:vi.fn() },
  listeners: new Map<string, () => void>(),
}));
vi.mock('@heybox/hb-sdk', () => {
  sdk.on.mockImplementation((event: string, handler: () => void) => { sdk.listeners.set(event, handler); return () => {}; });
  return { default:sdk };
});
import { getBoard, getCurrentPlayer, getMyEntry, readHostStorage, shareResult, submitResult, writeHostStorage } from './heybox';
const region = { getBoundingClientRect: () => ({left:10,top:10,width:350,height:400,right:360,bottom:410}) } as HTMLElement;
beforeEach(() => { vi.clearAllMocks(); sdk.listeners.get('heybox_app_login_change')?.(); sdk.user.getInfo.mockResolvedValue({isHeyboxAppLoggedIn:false,userInfo:null,authorization:null}); sdk.getHandshakeState.mockReturnValue({status:'ready'}); vi.stubGlobal('window',{innerWidth:390,innerHeight:844}); });
describe('SDK adapter contracts', () => {
  const account = { isHeyboxAppLoggedIn:true, authorization:{identity:'granted',profile:'granted'}, userInfo:{app_user_id:'isolated-player',profile:{nickname:'真实昵称',avatar:'https://example.com/avatar.jpg'},steam_id:'must-not-be-shared'} };
  it('shares only the granted display profile with both boards, without identity or Steam data', async () => {
    sdk.user.getInfo.mockResolvedValue(account);
    sdk.cloud.leaderboard.submit.mockResolvedValue({score:900,ranked:true,rank:1});
    for (const mode of ['sprint','survival'] as const) {
      await submitResult({id:mode,mode,score:100,correct:1,total:1,maxStreak:1,durationMs:1,finishedAt:1,history:[]});
    }
    expect(sdk.user.getInfo).toHaveBeenCalledTimes(1);
    for (const [payload] of sdk.cloud.leaderboard.submit.mock.calls) {
      expect(payload.extra.playerProfile).toEqual(account.userInfo.profile);
      expect(JSON.stringify(payload)).not.toContain('isolated-player');
      expect(JSON.stringify(payload)).not.toContain('must-not-be-shared');
      expect(new TextEncoder().encode(JSON.stringify(payload.extra)).length).toBeLessThanOrEqual(2048);
    }
  });
  it('does not block scores or public lists when optional profile reading fails', async () => {
    sdk.user.getInfo.mockRejectedValueOnce({code:'PERMISSION_DENIED'});
    sdk.cloud.leaderboard.submit.mockResolvedValue({score:100});
    sdk.cloud.leaderboard.getList.mockResolvedValue({entries:[],hasMore:false});
    await expect(submitResult({id:'no-profile',mode:'sprint',score:100,correct:1,total:1,maxStreak:1,durationMs:1,finishedAt:1,history:[]})).resolves.toMatchObject({score:100});
    expect(sdk.cloud.leaderboard.submit.mock.calls[0][0].extra).not.toHaveProperty('playerProfile');
    await expect(getBoard('sprint')).resolves.toMatchObject({entries:[]});
  });
  it('never submits a previous account score after the account changes during profile loading', async () => {
    let finish!: (value: unknown) => void;
    sdk.user.getInfo.mockImplementationOnce(() => new Promise(resolve => { finish=resolve; }));
    const pending=submitResult({id:'old-account',mode:'sprint',score:100,correct:1,total:1,maxStreak:1,durationMs:1,finishedAt:1,history:[]});
    sdk.listeners.get('heybox_app_login_change')?.();
    finish(account);
    await expect(pending).rejects.toMatchObject({code:'AUTHORIZATION_CONTEXT_CHANGED'});
    expect(sdk.cloud.leaderboard.submit).not.toHaveBeenCalled();
    sdk.user.getInfo.mockResolvedValue(account);
    await expect(getCurrentPlayer()).resolves.toMatchObject({appUserId:'isolated-player'});
  });
  it('does not publish a profile without granted disclosure', async () => {
    sdk.user.getInfo.mockResolvedValue({...account,authorization:{identity:'granted',profile:'denied'}});
    await expect(getCurrentPlayer()).resolves.toEqual({appUserId:'isolated-player',profile:{nickname:'',avatar:''}});
  });
  it('does not send platform requests while SDK is unavailable', async () => {
    sdk.getHandshakeState.mockReturnValue({status:'failed'});
    await expect(getBoard('sprint')).rejects.toMatchObject({code:'LOCAL_PREVIEW'});
    expect(sdk.cloud.leaderboard.getList).not.toHaveBeenCalled();
  });
  it('uses separate boards and forwards opaque cursors', async () => {
    sdk.cloud.leaderboard.getList.mockResolvedValue({entries:[],hasMore:false});
    await getBoard('survival','opaque-cursor');
    expect(sdk.cloud.leaderboard.getList).toHaveBeenCalledWith({key:'official_survival_v1',limit:20,cursor:'opaque-cursor'});
  });
  it('keeps the public list available when personal identity is unauthorized', async () => {
    sdk.cloud.leaderboard.getCurrentUserEntry.mockRejectedValueOnce({code:'UNAUTHORIZED'});
    sdk.cloud.leaderboard.getList.mockResolvedValue({entries:[{score:500}],hasMore:false});
    await expect(getMyEntry('sprint')).rejects.toMatchObject({code:'UNAUTHORIZED'});
    await expect(getBoard('sprint')).resolves.toMatchObject({entries:[{score:500}]});
    await expect(getBoard('survival')).resolves.toMatchObject({entries:[{score:500}]});
  });
  it('does not spread a personal endpoint cooldown to public reads or the other mode', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      sdk.cloud.leaderboard.getCurrentUserEntry.mockRejectedValueOnce({code:'RATE_LIMITED',data:{retryAfterMs:60000}});
      sdk.cloud.leaderboard.getList.mockResolvedValue({entries:[],hasMore:false});
      await expect(getMyEntry('sprint')).rejects.toMatchObject({code:'RATE_LIMITED'});
      await expect(getBoard('sprint')).resolves.toMatchObject({entries:[]});
      await expect(getBoard('survival')).resolves.toMatchObject({entries:[]});
      await expect(getMyEntry('sprint')).rejects.toMatchObject({code:'RATE_LIMITED_BY_RUNTIME'});
    } finally { clock.mockRestore(); }
  });
  it('does not reuse an in-flight pre-submit list after a successful score update', async () => {
    let finishOld!: (value: unknown) => void;
    sdk.cloud.leaderboard.getList.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({entries:[{score:900}],hasMore:false});
    const old = getBoard('sprint');
    sdk.cloud.leaderboard.submit.mockResolvedValue({score:900,ranked:false,rank:0});
    await submitResult({id:'refresh',mode:'sprint',score:900,correct:1,total:1,maxStreak:1,durationMs:1,finishedAt:1,history:[]});
    await expect(getBoard('sprint')).resolves.toMatchObject({entries:[{score:900}]});
    finishOld({entries:[],hasMore:false}); await old;
    expect(sdk.cloud.leaderboard.getList).toHaveBeenCalledTimes(2);
  });
  it('returns the server best entry rather than the attempted score', async () => {
    sdk.cloud.leaderboard.submit.mockResolvedValue({score:900,ranked:false,rank:0});
    const entry = await submitResult({id:'test',mode:'sprint',score:100,correct:1,total:1,maxStreak:1,durationMs:60000,finishedAt:1,history:[]});
    expect(entry.score).toBe(900);
    expect(sdk.cloud.leaderboard.submit.mock.calls[0][0]).not.toHaveProperty('appUserId');
  });
  it('captures a bounded light receipt and does not infer success from opaque return values', async () => {
    sdk.share.screenshot.mockResolvedValue(undefined);
    await expect(shareResult('sprint',region)).resolves.toBe('screenshot');
    expect(sdk.share.screenshot).toHaveBeenCalledWith(expect.objectContaining({watermarkTheme:'light',rect:{left:10,top:10,width:350,height:400}}));
  });
  it('uses a link if a short-screen scroll pane clips the receipt inside the window', async () => {
    vi.stubGlobal('getComputedStyle', () => ({overflowY:'auto',overflowX:'hidden'}));
    const clipped = { ...region, parentElement: {parentElement:null,getBoundingClientRect:()=>({left:0,right:390,top:0,bottom:300})} } as unknown as HTMLElement;
    await expect(shareResult('sprint',clipped)).resolves.toBe('link');
    expect(sdk.share.screenshot).not.toHaveBeenCalled();
  });
  it('falls back to a link only for an unsupported screenshot capability', async () => {
    sdk.share.screenshot.mockRejectedValueOnce({code:'METHOD_FORBIDDEN'});
    await expect(shareResult('survival',region)).resolves.toBe('link');
    expect(sdk.share.copyLink).toHaveBeenCalledWith({extra:{page:'home',mode:'survival'}});
    sdk.share.screenshot.mockRejectedValueOnce({code:'PERMISSION_DENIED'});
    await expect(shareResult('sprint',region)).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  });
  it('persists one bounded storage key and propagates failures to the UI', async () => {
    sdk.storage.getStorage.mockResolvedValue({data:{version:1}});
    await expect(readHostStorage()).resolves.toEqual({version:1});
    sdk.storage.setStorage.mockRejectedValueOnce({code:'STORAGE_QUOTA_EXCEEDED'});
    await expect(writeHostStorage({version:1})).rejects.toMatchObject({code:'STORAGE_QUOTA_EXCEEDED'});
  });
});
