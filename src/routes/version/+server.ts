import { league } from '#lib/server/league.ts';
import type { RequestHandler } from './$types';

/** Lets open pages find out, cheaply, whether the league changed since they loaded. */
export const GET: RequestHandler = () => {
	return Response.json(
		{ updatedAt: league().getUpdatedAt() },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
