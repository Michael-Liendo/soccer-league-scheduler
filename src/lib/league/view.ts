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

/** How many players a one-line roster names before it starts counting the rest. */
const ROSTER_LINE_SIZE = 6;

/**
 * "Ana · Luis · Pedro": the players of a team in one short line, for places with little room.
 * Large squads end with "y 5 más". Empty when the team is unknown or has no players yet.
 */
export function rosterLine(team: Team | undefined, limit = ROSTER_LINE_SIZE): string {
	if (!team) return '';
	const names = sortedPlayers(team).map((player) => player.name);
	// Hiding a single name would take as much room as showing it.
	if (names.length <= limit + 1) return names.join(' · ');
	return `${names.slice(0, limit).join(' · ')} y ${names.length - limit} más`;
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
	/** Minutes of the goals that were timed, in order. */
	goalMinutes: number[];
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
		const isOwnGoal = event.type === 'own_goal';
		const key = isOwnGoal
			? 'own-goal'
			: event.playerId === null
				? `name:${event.playerName}`
				: `player:${event.playerId}`;
		let entry = summary.get(key);
		if (!entry) {
			const name = isOwnGoal
				? 'Autogol'
				: (event.playerId !== null && names.get(event.playerId)) || event.playerName || 'Gol';
			entry = { key, name, goals: 0, goalMinutes: [], yellows: 0, reds: 0 };
			summary.set(key, entry);
		}
		if (event.type === 'goal' || isOwnGoal) {
			entry.goals += 1;
			if (event.minute !== null) entry.goalMinutes.push(event.minute);
		} else if (event.type === 'yellow') entry.yellows += 1;
		else entry.reds += 1;
	}
	return [...summary.values()];
}

/** "5', 12'" when every goal was timed, "×2" when not, and nothing for a single untimed goal. */
export function goalsLabel(player: PlayerEvents): string {
	if (player.goals === 0) return '';
	if (player.goalMinutes.length === player.goals) {
		return player.goalMinutes.map((minute) => `${minute}'`).join(', ');
	}
	return player.goals > 1 ? `×${player.goals}` : '';
}

/** 1-based position of every match within its day, in playing order. */
export function orderOfPlay(league: League): Map<number, number> {
	const order = new Map<number, number>();
	for (const { matches } of scheduleByDay(league)) {
		matches.forEach((match, index) => order.set(match.id, index + 1));
	}
	return order;
}

/** The matches being played right now and the next one waiting to start. */
export function nowAndNext(league: League): { live: Match[]; next: Match | undefined } {
	return {
		live: league.matches.filter((match) => match.status === 'live'),
		next: league.matches.find((match) => match.status === 'pending')
	};
}
