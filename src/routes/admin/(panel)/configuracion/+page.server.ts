import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import { requireAdmin } from '#lib/server/session.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	saveSettings: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().updateSettings({
				name: text(form, 'name'),
				location: text(form, 'location'),
				venue: text(form, 'venue'),
				playersOnField: integer(form, 'playersOnField'),
				points: {
					win: integer(form, 'pointsWin'),
					draw: integer(form, 'pointsDraw'),
					loss: integer(form, 'pointsLoss')
				}
			});
			return { message: 'Configuración guardada' };
		});
	},

	reset: async ({ locals }) => {
		requireAdmin(locals);
		return attempt(() => {
			league().resetTournament();
			return { message: 'Torneo reiniciado' };
		});
	}
};
