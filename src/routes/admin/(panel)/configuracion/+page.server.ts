import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	saveSettings: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().updateSettings({
				name: text(form, 'name'),
				location: text(form, 'location'),
				venue: text(form, 'venue'),
				playersOnField: integer(form, 'playersOnField')
			});
			return { message: 'Configuración guardada' };
		});
	},

	reset: async () => {
		return attempt(() => {
			league().resetTournament();
			return { message: 'Torneo reiniciado' };
		});
	}
};
