import {
	FORFEIT_GOALS,
	MATCH_EVENT_TYPES,
	MATCH_STATUSES,
	SIDES,
	type MatchEventType,
	type MatchStatus
} from '#lib/league/types.ts';
import { LeagueError } from '#lib/server/errors.ts';
import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import { requireAdmin, requireOwner } from '#lib/server/session.ts';
import type { Actions } from './$types';

const STATUS_MESSAGES: Record<MatchStatus, string> = {
	pending: 'Partido marcado como por jugar',
	live: 'Partido en vivo',
	finished: 'Partido finalizado'
};

const EVENT_MESSAGES: Record<MatchEventType, (player: string) => string> = {
	goal: (player) => (player ? `Gol de ${player}` : 'Gol anotado'),
	double_goal: (player) => (player ? `Gol doble de ${player}` : 'Gol doble anotado'),
	own_goal: () => 'Autogol anotado',
	yellow: (player) => `Amarilla para ${player}`,
	blue: (player) => `Azul para ${player}`,
	red: (player) => `Roja para ${player}`
};

function oneOf<T extends string>(options: readonly T[], value: string, label: string): T {
	if (!(options as readonly string[]).includes(value)) throw new LeagueError(`${label} no válido.`);
	return value as T;
}

export const actions: Actions = {
	reschedule: async ({ request, locals }) => {
		requireAdmin(locals);
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

	move: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const direction = oneOf(['earlier', 'later'] as const, text(form, 'direction'), 'Orden');
			league().moveMatch(integer(form, 'matchId'), direction);
			return {};
		});
	},

	status: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const status = oneOf(MATCH_STATUSES, text(form, 'status'), 'Estado');
			league().setMatchStatus(integer(form, 'matchId'), status);
			return { message: STATUS_MESSAGES[status] };
		});
	},

	/** The clock buttons: start or resume, pause, and the final whistle. */
	clock: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const matchId = integer(form, 'matchId');
			const step = oneOf(['start', 'pause', 'finish'] as const, text(form, 'step'), 'Acción');
			if (step === 'start') league().startMatch(matchId);
			else if (step === 'pause') league().pauseMatch(matchId);
			else league().finishMatch(matchId);
			const messages = {
				start: 'Reloj en marcha',
				pause: 'Reloj en pausa',
				finish: 'Partido finalizado'
			};
			return { message: messages[step] };
		});
	},

	/** A team did not show up: its rival wins without playing. */
	forfeit: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const absent = oneOf(SIDES, text(form, 'absent'), 'Equipo');
			league().forfeitMatch(integer(form, 'matchId'), absent);
			return { message: `Partido cerrado por W.O.: ${FORFEIT_GOALS}–0` };
		});
	},

	setClock: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const minutes = integer(form, 'minutes');
			if (!Number.isInteger(minutes) || minutes < 0)
				throw new LeagueError('Escribe los minutos jugados.');
			league().setClock(integer(form, 'matchId'), minutes * 60_000);
			return { message: `Reloj puesto en el minuto ${minutes}` };
		});
	},

	/**
	 * Records a goal or a card. `playerId` names the player; `newPlayer` adds someone to the
	 * roster on the spot; with neither, a goal is recorded without a scorer.
	 */
	addEvent: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const type = oneOf(MATCH_EVENT_TYPES, text(form, 'type'), 'Evento');
			const teamId = integer(form, 'teamId');
			const store = league();

			const newPlayer = text(form, 'newPlayer').trim();
			let playerId: number | null = text(form, 'playerId') ? integer(form, 'playerId') : null;
			if (newPlayer && type !== 'own_goal') {
				playerId = store.addPlayer(teamId, { name: newPlayer, number: null, position: null });
			}
			store.addMatchEvent(integer(form, 'matchId'), { teamId, playerId, type });

			const team = store.getLeague().teams.find((candidate) => candidate.id === teamId);
			const player = team?.players.find((candidate) => candidate.id === playerId);
			return { message: EVENT_MESSAGES[type](player?.name ?? '') };
		});
	},

	setMinute: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			const minute = text(form, 'minute').trim();
			league().setEventMinute(integer(form, 'eventId'), minute ? integer(form, 'minute') : null);
			return {};
		});
	},

	removeEvent: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().removeMatchEvent(integer(form, 'eventId'));
			return { message: 'Borrado' };
		});
	},

	resetMatch: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			requireOwner(locals);
			league().resetMatch(integer(form, 'matchId'));
			return { message: 'Resultado borrado' };
		});
	}
};
