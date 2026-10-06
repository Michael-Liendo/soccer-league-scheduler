import { todayIso } from '#lib/league/format.ts';
import { league } from '#lib/server/league.ts';
import type { RequestHandler } from './$types';

function slug(text: string): string {
	return (
		text
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'copa'
	);
}

/** Downloads everything the league holds as a JSON file, to keep a copy outside the server. */
export const GET: RequestHandler = () => {
	const snapshot = league().getLeague();
	const filename = `respaldo-${slug(snapshot.tournament.name)}-${todayIso()}.json`;
	const body = JSON.stringify(
		{ exportedAt: new Date().toISOString(), league: snapshot },
		null,
		'\t'
	);

	return new Response(body, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`,
			'cache-control': 'no-store'
		}
	});
};
