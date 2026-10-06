import { plural } from '#lib/league/format.ts';
import { parsePlayers, parseTeams, type TypedTeam } from '#lib/league/roster-text.ts';
import { POSITIONS, type Position } from '#lib/league/types.ts';
import { LeagueError } from '#lib/server/errors.ts';
import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import { requireAdmin } from '#lib/server/session.ts';
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

/** Teams drawn in the browser arrive as JSON: `[{ name, players: [{ name, number }] }]`. */
function readDrawnTeams(json: string): TypedTeam[] {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		throw new LeagueError('No se pudieron leer los equipos sorteados.');
	}
	if (!Array.isArray(value)) throw new LeagueError('No se pudieron leer los equipos sorteados.');
	return value.map((team) => ({
		name: String(team?.name ?? ''),
		players: (Array.isArray(team?.players) ? team.players : []).map(
			(player: { name?: unknown; number?: unknown }) => ({
				name: String(player?.name ?? ''),
				number: typeof player?.number === 'string' ? player.number : null
			})
		)
	}));
}

export const actions: Actions = {
	/** Several teams at once: typed one per line, or drawn at random in the browser. */
	createTeams: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const drawn = text(form, 'drawn');
			const typed = drawn ? readDrawnTeams(drawn) : parseTeams(text(form, 'teams'));
			if (typed.length === 0) throw new LeagueError('Escribe al menos un equipo.');
			const { created, skipped } = league().createTeams(
				typed.map((team) => ({
					name: team.name,
					players: team.players.map((player) => ({ ...player, position: null }))
				}))
			);
			const done =
				created.length === 0
					? 'No se creó ningún equipo'
					: `${plural(created.length, 'equipo')} listo${created.length === 1 ? '' : 's'}`;
			const repeated = skipped.length > 0 ? `. Ya existían: ${skipped.join(', ')}` : '';
			return { message: done + repeated };
		});
	},

	addPlayers: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const typed = parsePlayers(text(form, 'players'));
			const added = league().addPlayers(
				integer(form, 'teamId'),
				typed.map((player) => ({ ...player, position: null }))
			);
			return { message: `${plural(added, 'jugador', 'jugadores')} en la plantilla` };
		});
	},

	createTeam: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const team = readTeam(form);
			league().createTeam(team);
			return { message: `Equipo “${team.name.trim()}” creado` };
		});
	},

	updateTeam: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().updateTeam(integer(form, 'teamId'), readTeam(form));
			return { message: 'Equipo actualizado' };
		});
	},

	deleteTeam: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().deleteTeam(integer(form, 'teamId'));
			return { message: 'Equipo eliminado' };
		});
	},

	addPlayer: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const player = readPlayer(form);
			league().addPlayer(integer(form, 'teamId'), player);
			return { message: `${player.name.trim()} añadido a la plantilla` };
		});
	},

	updatePlayer: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().updatePlayer(integer(form, 'playerId'), readPlayer(form));
			return {};
		});
	},

	deletePlayer: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().deletePlayer(integer(form, 'playerId'));
			return { message: 'Jugador quitado de la plantilla' };
		});
	}
};
