import { todayIso } from '#lib/league/format.ts';
import { league } from '#lib/server/league.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		league: league().getLeague(),
		/** Today's date where the league is played, so server and browser agree on it. */
		today: todayIso(),
		/** The server's clock, so match timers do not depend on each phone's own. */
		now: Date.now(),
		isAdmin: locals.isAdmin
	};
};
