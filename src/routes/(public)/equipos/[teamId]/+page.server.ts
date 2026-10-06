import { error } from '@sveltejs/kit';
import { league } from '#lib/server/league.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const teamId = /^\d+$/.test(params.teamId) ? Number(params.teamId) : Number.NaN;
	const exists = league()
		.getLeague()
		.teams.some((team) => team.id === teamId);
	if (!exists) error(404, 'Ese equipo no existe.');
	return { teamId };
};
