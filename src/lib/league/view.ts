/** Helpers that shape league data for the screens. All pure, so they run the same on both sides. */
import { capitalize, formatDate, formatDateRange } from './format.ts';
import { champion } from './standings.ts';
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
	if (pending.length === 0) {
		const winner = champion(league);
		const name = league.teams.find((team) => team.id === winner?.teamId)?.name;
		return name ? `Campeón: ${name}` : 'Torneo terminado';
	}

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

export interface PlayerEvents {
	key: string;
	name: string;
	goals: number;
	yellows: number;
	reds: number;
}

/** What each player of one side did in a match, in the order they first appear. */
export function eventsByPlayer(match: Match, team: Team | undefined): PlayerEvents[] {
	if (!team) return [];
	const names = new Map(team.players.map((player) => [player.id, player.name]));
	const summary = new Map<string, PlayerEvents>();
	for (const event of match.events) {
		if (event.teamId !== team.id) continue;
		const key = event.playerId === null ? `name:${event.playerName}` : `player:${event.playerId}`;
		let entry = summary.get(key);
		if (!entry) {
			const name = (event.playerId !== null && names.get(event.playerId)) || event.playerName;
			entry = { key, name, goals: 0, yellows: 0, reds: 0 };
			summary.set(key, entry);
		}
		if (event.type === 'goal') entry.goals += 1;
		else if (event.type === 'yellow') entry.yellows += 1;
		else entry.reds += 1;
	}
	return [...summary.values()];
}

/** Goals of a side that were recorded with a scorer. */
export function creditedGoals(match: Match, teamId: number): number {
	return match.events.filter((event) => event.type === 'goal' && event.teamId === teamId).length;
}
