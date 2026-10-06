import {
	MATCH_EVENT_TYPES,
	MATCH_STATUSES,
	type MatchEventType,
	type MatchStatus
} from '#lib/league/types.ts';
import { LeagueError } from '#lib/server/errors.ts';
import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import type { Actions } from './$types';

const STATUS_MESSAGES: Record<MatchStatus, string> = {
	pending: 'Partido marcado como por jugar',
	live: 'Partido en vivo',
	finished: 'Partido finalizado'
};

const EVENT_MESSAGES: Record<MatchEventType, (player: string) => string> = {
	goal: (player) => `Gol de ${player}`,
	yellow: (player) => `Amarilla para ${player}`,
	red: (player) => `Roja para ${player}`
};

function oneOf<T extends string>(options: readonly T[], value: string, label: string): T {
	if (!(options as readonly string[]).includes(value)) throw new LeagueError(`${label} no válido.`);
	return value as T;
}

export const actions: Actions = {
	reschedule: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().updateMatchSchedule(integer(form, 'matchId'), {
				matchDayId: integer(form, 'matchDayId'),
				time: text(form, 'time') || null,
				venue: text(form, 'venue') || null
			});
			return { message: 'Día y hora actualizados' };
		});
	},

	status: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			const status = oneOf(MATCH_STATUSES, text(form, 'status'), 'Estado');
			league().setMatchStatus(integer(form, 'matchId'), status);
			return { message: STATUS_MESSAGES[status] };
		});
	},

	score: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			const side = oneOf(['home', 'away'] as const, text(form, 'side'), 'Equipo');
			league().adjustScore(integer(form, 'matchId'), side, integer(form, 'delta') < 0 ? -1 : 1);
			return {};
		});
	},

	addEvent: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			const type = oneOf(MATCH_EVENT_TYPES, text(form, 'type'), 'Evento');
			const teamId = integer(form, 'teamId');
			const playerId = integer(form, 'playerId');
			const store = league();
			store.addMatchEvent(integer(form, 'matchId'), { teamId, playerId, type });

			const team = store.getLeague().teams.find((candidate) => candidate.id === teamId);
			const player = team?.players.find((candidate) => candidate.id === playerId);
			return { message: EVENT_MESSAGES[type](player?.name ?? 'jugador') };
		});
	},

	removeEvent: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().removeMatchEvent(integer(form, 'eventId'));
			return { message: 'Evento borrado' };
		});
	},

	resetMatch: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			league().resetMatch(integer(form, 'matchId'));
			return { message: 'Resultado borrado' };
		});
	}
};
