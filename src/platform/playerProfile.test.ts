import { describe, expect, it } from 'vitest';
import { playerPresentation, readPlayerProfile } from './playerProfile';

describe('leaderboard display profiles', () => {
  it('uses the current account for its own historical row and never for another player', () => {
    const current = {appUserId:'me',profile:{nickname:'当前昵称',avatar:'https://example.com/me.jpg'}};
    expect(playerPresentation({appUserId:'me',extra:{}},current)).toMatchObject({self:true,nickname:'当前昵称',avatar:current.profile.avatar});
    expect(playerPresentation({appUserId:'other',extra:{playerProfile:{nickname:'另一玩家',avatar:'https://example.com/other.jpg'}}},current)).toMatchObject({self:false,nickname:'另一玩家'});
    expect(playerPresentation({appUserId:'other',extra:{}},current)).toMatchObject({self:false,nickname:'鉴定员 · ther',avatar:''});
  });
  it('rejects invalid avatar URLs and normalizes public HTTPS resources', () => {
    for (const avatar of ['javascript:alert(1)','data:image/svg+xml,x','file:///x','http://example.com/x','https://user:pass@example.com/x','not a url']) {
      expect(readPlayerProfile({nickname:'盒友',avatar})).toEqual({nickname:'盒友',avatar:''});
    }
    expect(readPlayerProfile({nickname:'盒友',avatar:'//example.com/x'})).toEqual({nickname:'盒友',avatar:'https://example.com/x'});
  });
  it('bounds display snapshots and keeps nicknames as plain data', () => {
    const profile=readPlayerProfile({nickname:'\u202e'+ '盒'.repeat(100),avatar:'https://example.com/'+'a'.repeat(2000)});
    expect(profile?.nickname).toHaveLength(64);
    expect(profile?.avatar).toBe('');
    expect(readPlayerProfile(null)).toBeUndefined();
    expect(readPlayerProfile({nickname:' ',avatar:42})).toBeUndefined();
    expect(readPlayerProfile({nickname:'<script>1</script>'})?.nickname).toBe('<script>1</script>');
  });
});
