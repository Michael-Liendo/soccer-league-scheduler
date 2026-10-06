/** League table and statistics, derived from the matches and the events recorded in them. */
import type { League, Match, Position, Team } from './types.ts';

export type FormResult = 'W' | 'D' | 'L';

export interface StandingRow {
	teamId: number;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	points: number;
	/** Results of the finished matches, oldest first. */
	form: FormResult[];
}

export interface PlayerStat {
	/** Stable key for lists: the player id, or team and name for players no longer on a roster. */
	key: string;
	playerId: number | null;
	teamId: number;
	name: string;
	number: string | null;
	position: Position | null;
	goals: number;
	yellows: number;
	reds: number;
}

export interface FairPlayRow {
	teamId: number;
	yellows: number;
	reds: number;
	/** One point per yellow card and three per red. Fewer is better. */
	points: number;
}

export interface DefenseRow {
	teamId: number;
	played: number;
	goalsAgainst: number;
	goalsAgainstPerMatch: number;
	/** Matches finished without conceding. */
	cleanSheets: number;
}

export const FAIR_PLAY_POINTS = { yellow: 1, red: 3 } as const;

type Scoring = Pick<League['tournament'], 'pointsWin' | 'pointsDraw' | 'pointsLoss'>;

function finished(matches: readonly Match[]): Match[] {
	return matches.filter((match) => match.status === 'finished');
}

export function fairPlayTable(teams: readonly Team[], matches: readonly Match[]): FairPlayRow[] {
	const rows = new Map<number, FairPlayRow>(
		teams.map((team) => [team.id, { teamId: team.id, yellows: 0, reds: 0, points: 0 }])
	);
	for (const match of matches) {
		for (const event of match.events) {
			const row = rows.get(event.teamId);
			if (!row || event.type === 'goal') continue;
			if (event.type === 'yellow') row.yellows += 1;
			else row.reds += 1;
			row.points += FAIR_PLAY_POINTS[event.type];
		}
	}
	const names = new Map(teams.map((team) => [team.id, team.name]));
	return [...rows.values()].sort(
		(a, b) =>
			a.points - b.points ||
			a.reds - b.reds ||
			(names.get(a.teamId) ?? '').localeCompare(names.get(b.teamId) ?? '', 'es')
	);
}

/**
 * The league table. Only finished matches count. Teams level on points are separated by goal
 * difference, then goals scored, then fair play, and finally by name.
 */
export function computeStandings(
	teams: readonly Team[],
	matches: readonly Match[],
	scoring: Scoring
): StandingRow[] {
	const rows = new Map<number, StandingRow>(
		teams.map((team) => [
			team.id,
			{
				teamId: team.id,
				played: 0,
				won: 0,
				drawn: 0,
				lost: 0,
				goalsFor: 0,
				goalsAgainst: 0,
				goalDifference: 0,
				points: 0,
				form: []
			}
		])
	);

	const record = (row: StandingRow, scored: number, conceded: number) => {
		row.played += 1;
		row.goalsFor += scored;
		row.goalsAgainst += conceded;
		row.goalDifference = row.goalsFor - row.goalsAgainst;
		if (scored > conceded) {
			row.won += 1;
			row.points += scoring.pointsWin;
			row.form.push('W');
		} else if (scored < conceded) {
			row.lost += 1;
			row.points += scoring.pointsLoss;
			row.form.push('L');
		} else {
			row.drawn += 1;
			row.points += scoring.pointsDraw;
			row.form.push('D');
		}
	};

	for (const match of finished(matches)) {
		const home = rows.get(match.homeTeamId);
		const away = rows.get(match.awayTeamId);
		if (!home || !away) continue;
		record(home, match.homeScore, match.awayScore);
		record(away, match.awayScore, match.homeScore);
	}

	const fairPlay = new Map(fairPlayTable(teams, matches).map((row) => [row.teamId, row.points]));
	const names = new Map(teams.map((team) => [team.id, team.name]));
	return [...rows.values()].sort(
		(a, b) =>
			b.points - a.points ||
			b.goalDifference - a.goalDifference ||
			b.goalsFor - a.goalsFor ||
			(fairPlay.get(a.teamId) ?? 0) - (fairPlay.get(b.teamId) ?? 0) ||
			(names.get(a.teamId) ?? '').localeCompare(names.get(b.teamId) ?? '', 'es')
	);
}

/** Goals and cards per player, across every match. */
export function computePlayerStats(
	teams: readonly Team[],
	matches: readonly Match[]
): PlayerStat[] {
	const roster = new Map(
		teams.flatMap((team) => team.players.map((player) => [player.id, player]))
	);
	const teamIds = new Set(teams.map((team) => team.id));
	const stats = new Map<string, PlayerStat>();

	for (const match of matches) {
		for (const event of match.events) {
			if (!teamIds.has(event.teamId)) continue;
			const player = event.playerId === null ? undefined : roster.get(event.playerId);
			const key = player ? `player:${player.id}` : `name:${event.teamId}:${event.playerName}`;
			let stat = stats.get(key);
			if (!stat) {
				stat = {
					key,
					playerId: player?.id ?? null,
					teamId: event.teamId,
					name: player?.name ?? event.playerName,
					number: player?.number ?? null,
					position: player?.position ?? null,
					goals: 0,
					yellows: 0,
					reds: 0
				};
				stats.set(key, stat);
			}
			if (event.type === 'goal') stat.goals += 1;
			else if (event.type === 'yellow') stat.yellows += 1;
			else stat.reds += 1;
		}
	}
	return [...stats.values()];
}

export function topScorers(stats: readonly PlayerStat[]): PlayerStat[] {
	return stats
		.filter((stat) => stat.goals > 0)
		.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'es'));
}

/** Players with cards, the most penalised first. */
export function cardedPlayers(stats: readonly PlayerStat[]): PlayerStat[] {
	const weight = (stat: PlayerStat) =>
		stat.reds * FAIR_PLAY_POINTS.red + stat.yellows * FAIR_PLAY_POINTS.yellow;
	return stats
		.filter((stat) => stat.yellows > 0 || stat.reds > 0)
		.sort((a, b) => weight(b) - weight(a) || a.name.localeCompare(b.name, 'es'));
}

/** Teams ordered by goals conceded per finished match, the tightest defence first. */
export function defenseTable(teams: readonly Team[], matches: readonly Match[]): DefenseRow[] {
	const rows = new Map<number, DefenseRow>(
		teams.map((team) => [
			team.id,
			{ teamId: team.id, played: 0, goalsAgainst: 0, goalsAgainstPerMatch: 0, cleanSheets: 0 }
		])
	);
	const record = (teamId: number, conceded: number) => {
		const row = rows.get(teamId);
		if (!row) return;
		row.played += 1;
		row.goalsAgainst += conceded;
		if (conceded === 0) row.cleanSheets += 1;
		row.goalsAgainstPerMatch = row.goalsAgainst / row.played;
	};
	for (const match of finished(matches)) {
		record(match.homeTeamId, match.awayScore);
		record(match.awayTeamId, match.homeScore);
	}
	const names = new Map(teams.map((team) => [team.id, team.name]));
	return [...rows.values()]
		.filter((row) => row.played > 0)
		.sort(
			(a, b) =>
				a.goalsAgainstPerMatch - b.goalsAgainstPerMatch ||
				b.cleanSheets - a.cleanSheets ||
				b.played - a.played ||
				(names.get(a.teamId) ?? '').localeCompare(names.get(b.teamId) ?? '', 'es')
		);
}

/** The winner, once every match has been played. */
export function champion(league: League): StandingRow | null {
	if (league.matches.length === 0) return null;
	if (league.matches.some((match) => match.status !== 'finished')) return null;
	return computeStandings(league.teams, league.matches, league.tournament)[0] ?? null;
}
