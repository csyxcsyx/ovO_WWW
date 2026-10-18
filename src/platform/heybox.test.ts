import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  getHandshakeState: vi.fn(() => ({status:'ready'})), on: vi.fn(() => () => {}),
  cloud: { leaderboard: { getList:vi.fn(), getCurrentUserEntry:vi.fn(), submit:vi.fn() } },
  share: { copyLink:vi.fn(), screenshot:vi.fn(), getExtra:vi.fn() },
  storage: { getStorage:vi.fn(), setStorage:vi.fn() },
}));
vi.mock('@heybox/hb-sdk', () => ({ default:sdk }));
import { getBoard, readHostStorage, shareResult, submitResult, writeHostStorage } from './heybox';
const region = { getBoundingClientRect: () => ({left:10,top:10,width:350,height:400,right:360,bottom:410}) } as HTMLElement;
beforeEach(() => { vi.clearAllMocks(); sdk.getHandshakeState.mockReturnValue({status:'ready'}); vi.stubGlobal('window',{innerWidth:390,innerHeight:844}); });
describe('SDK adapter contracts', () => {
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
