import hbSDK from '@heybox/hb-sdk';
import { cloudCall, getIdentityRevision, requireHost, subscribeLogin, subscribeUnload } from './heybox';
import { ProfileDirectory } from './profileDirectory';
import type { CurrentPlayer } from './playerProfile';

export const PROFILE_KEY = 'official_profiles_v1';
export const profiles = new ProfileDirectory({
  current: () => { requireHost(); return cloudCall('profile-current', () => hbSDK.cloud.leaderboard.getCurrentUserEntry({ key: PROFILE_KEY })); },
  submit: (score, playerProfile) => { requireHost(); return cloudCall('profile-submit', () => hbSDK.cloud.leaderboard.submit({ key: PROFILE_KEY, score, extra: { version: 1, playerProfile } })); },
  list: cursor => { requireHost(); return cloudCall('profile-list', () => hbSDK.cloud.leaderboard.getList({ key: PROFILE_KEY, limit: 100, ...(cursor ? { cursor } : {}) })); },
});
subscribeLogin(() => profiles.reset());
subscribeUnload(() => profiles.reset());
export async function syncPlayerProfile(player: CurrentPlayer, revision: number) {
  if (revision !== getIdentityRevision()) return;
  await profiles.syncOwn(player);
}
