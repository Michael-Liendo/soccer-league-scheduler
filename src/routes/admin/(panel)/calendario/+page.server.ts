import { plural } from '#lib/league/format.ts';
import { attempt, integer, text, texts, toInteger } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import type { PlanInput } from '#lib/server/league-store.ts';
import type { Actions } from './$types';

/**
 * Reads the planner form: one `dayId`, `dayDate` and `dayMatches` field per match day, plus the
 * timetable. Days come back in date order, which is the order the calendar uses.
 */
function readPlanner(form: FormData): { plan: PlanInput; matchesPerDay: number[] } {
	const ids = texts(form, 'dayId');
	const matchCounts = texts(form, 'dayMatches');
	const days = texts(form, 'dayDate')
		.map((date, index) => ({
			id: ids[index] ? toInteger(ids[index]) : null,
			date,
			matches: toInteger(matchCounts[index] ?? '')
		}))
		.sort((a, b) => a.date.localeCompare(b.date));

	return {
		plan: {
			days: days.map(({ id, date }) => ({ id, date })),
			timing: {
				startTime: text(form, 'startTime'),
				endTime: text(form, 'endTime'),
				matchMinutes: integer(form, 'matchMinutes'),
				breakMinutes: integer(form, 'breakMinutes')
			}
		},
		matchesPerDay: days.map((day) => day.matches)
	};
}

export const actions: Actions = {
	savePlan: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			const { retimed } = league().savePlan(readPlanner(form).plan);
			return {
				message: retimed
					? 'Días y horario guardados. Se recalcularon las horas de los partidos.'
					: 'Días y horario guardados'
			};
		});
	},

	generate: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => {
			const random = text(form, 'draw') === 'random';
			const { matchCount } = league().generateSchedule({
				...readPlanner(form),
				legs: integer(form, 'legs'),
				random
			});
			const total = plural(matchCount, 'partido');
			return { message: `Calendario ${random ? 'sorteado' : 'generado'}: ${total}` };
		});
	},

	clear: async () => {
		return attempt(() => {
			league().clearSchedule();
			return { message: 'Calendario borrado' };
		});
	}
};
