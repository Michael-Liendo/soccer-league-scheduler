import { attempt, integer } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import { requireAdmin, requireOwner } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ archives: league().listArchives() });

export const actions: Actions = {
	remove: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			requireOwner(locals);
			league().deleteArchive(integer(form, 'id'));
			return { message: 'Torneo quitado del historial' };
		});
	}
};
