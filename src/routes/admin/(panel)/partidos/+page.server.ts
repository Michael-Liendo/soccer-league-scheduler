import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	reschedule: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().updateMatchSchedule(integer(form, 'matchId'), {
				matchDayId: integer(form, 'matchDayId'),
				time: text(form, 'time') || null,
				venue: text(form, 'venue') || null
			});
			return { message: 'Partido actualizado' };
		});
	}
};
