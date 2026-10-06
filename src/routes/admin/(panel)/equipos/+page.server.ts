import { POSITIONS, type Position } from '#lib/league/types.ts';
import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import type { Actions } from './$types';

function readPlayer(form: FormData) {
	const position = text(form, 'position');
	return {
		name: text(form, 'name'),
		number: text(form, 'number') || null,
		position: (POSITIONS as readonly string[]).includes(position) ? (position as Position) : null
	};
}

function readTeam(form: FormData) {
	return { name: text(form, 'name'), color: text(form, 'color') };
}

export const actions: Actions = {
	createTeam: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			const team = readTeam(form);
			league().createTeam(team);
			return { message: `Equipo “${team.name.trim()}” creado` };
		});
	},

	updateTeam: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().updateTeam(integer(form, 'teamId'), readTeam(form));
			return { message: 'Equipo actualizado' };
		});
	},

	deleteTeam: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().deleteTeam(integer(form, 'teamId'));
			return { message: 'Equipo eliminado' };
		});
	},

	addPlayer: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			const player = readPlayer(form);
			league().addPlayer(integer(form, 'teamId'), player);
			return { message: `${player.name.trim()} añadido a la plantilla` };
		});
	},

	updatePlayer: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().updatePlayer(integer(form, 'playerId'), readPlayer(form));
			return {};
		});
	},

	deletePlayer: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().deletePlayer(integer(form, 'playerId'));
			return { message: 'Jugador quitado de la plantilla' };
		});
	}
};
