import { LeaderboardStore } from './leaderboardStore';
import { getBoard, getMyEntry, getCurrentPlayer, subscribeBoardChange, subscribeUnload } from './heybox';

export const leaderboards = new LeaderboardStore({ list: getBoard, personal: getMyEntry, player: getCurrentPlayer });
subscribeBoardChange((mode, entry) => { if (mode) leaderboards.invalidate(mode, entry); else leaderboards.reset(); });
subscribeUnload(() => leaderboards.reset());
