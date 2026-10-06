/** Helpers that shape league data for the screens. All pure, so they run the same on both sides. */
import { capitalize, formatDate, formatDateRange } from './format.ts';
import type { League, Match, MatchDay, Player, Team } from './types.ts';

export function teamsById(teams: readonly Team[]): Map<number, Team> {
	return new Map(teams.map((team) => [team.id, team]));
}

export interface DaySchedule {
	day: MatchDay;
	matches: Match[];
}

/** Every match day with its matches, including days that have none yet. */
export function scheduleByDay(league: League): DaySchedule[] {
	return league.matchDays.map((day) => ({
		day,
		matches: league.matches.filter((match) => match.matchDayId === day.id)
	}));
}

/** Players ordered by shirt number, with unnumbered players last by name. */
export function sortedPlayers(team: Team): Player[] {
	return [...team.players].sort((a, b) => {
		const first = a.number === null ? Number.NaN : Number(a.number);
		const second = b.number === null ? Number.NaN : Number(b.number);
		if (Number.isNaN(first) && Number.isNaN(second)) return a.name.localeCompare(b.name, 'es');
		if (Number.isNaN(first)) return 1;
		if (Number.isNaN(second)) return -1;
		return first - second || a.name.localeCompare(b.name, 'es');
	});
}

/** "Naiguatá · del 10 al 31 de octubre" */
export function leagueKicker(league: League): string {
	const days = league.matchDays;
	if (days.length === 0) return league.tournament.location;
	const range = formatDateRange(days[0].date, days[days.length - 1].date);
	return `${league.tournament.location} · ${range}`;
}

/** One line telling visitors where the tournament stands today. */
export function leaguePhase(league: League, today: string): string {
	if (league.matches.length === 0) return 'Todavía sin calendario';

	const pending = league.matches.filter((match) => match.status !== 'finished');
	if (pending.length === 0) return 'Torneo terminado';

	const pendingDayIds = new Set(pending.map((match) => match.matchDayId));
	const current = league.matchDays.find((day) => pendingDayIds.has(day.id));
	if (!current) return 'Calendario publicado';

	const label = `Jornada ${current.number} de ${league.matchDays.length}`;
	if (league.matches.some((match) => match.status === 'live')) return `${label}, en juego`;
	if (current.date === today) return `${label} · hoy`;
	if (current.date > today && current.number === 1) {
		return `Arranca el ${formatDate(current.date, 'long')}`;
	}
	return `${label} · ${capitalize(formatDate(current.date, 'long'))}`;
}

/** First and last kick-off of a list of matches, or `null` when none has a time. */
export function kickoffRange(matches: readonly Match[]): { first: string; last: string } | null {
	const times = matches.flatMap((match) => (match.time ? [match.time] : [])).sort();
	if (times.length === 0) return null;
	return { first: times[0], last: times[times.length - 1] };
}

export function venueOf(match: Match, league: League): string {
	return match.venue ?? league.tournament.venue;
}
