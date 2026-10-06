import { league } from '#lib/server/league.ts';
import type { RequestHandler } from './$types';

/** Liveness probe for the hosting platform: answers once the database can be read. */
export const GET: RequestHandler = () => {
	league().getLeague();
	return new Response('ok', { headers: { 'cache-control': 'no-store' } });
};
