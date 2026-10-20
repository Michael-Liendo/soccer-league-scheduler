/** A finished tournament, frozen so it can be shown after the league starts again. */
import { podium } from './playoffs.ts';
import { computePlayerStats, computeStandings, topScorers } from './standings.ts';
import type { League, Stage } from './types.ts';

export interface ArchivedTournament {
	title: string;
	/** `YYYY-MM-DD` of the first and last match days. */
	from: string | null;
	to: string | null;
	champion: string | null;
	runnerUp: string | null;
	third: string | null;
	table: {
		team: string;
		points: number;
		played: number;
		won: number;
		drawn: number;
		lost: number;
		goalsFor: number;
		goalsAgainst: number;
	}[];
	scorers: { name: string; team: string; goals: number }[];
	results: {
		stage: Stage;
		home: string;
		away: string;
		homeScore: number;
		awayScore: number;
		walkover: boolean;
	}[];
}

/** Freezes the league as it stands. `champion` overrides the one the results give, if any. */
export function archiveSnapshot(
	league: League,
	title: string,
	championOverride: string | null
): ArchivedTournament {
	const names = new Map(league.teams.map((team) => [team.id, team.name]));
	const name = (id: number | null | undefined) => (id == null ? null : (names.get(id) ?? null));
	const places = podium(league);
	const daysWithMatches = league.matchDays.filter((day) =>
		league.matches.some((match) => match.matchDayId === day.id && match.status === 'finished')
	);
	return {
		title,
		from: daysWithMatches[0]?.date ?? null,
		to: daysWithMatches.at(-1)?.date ?? null,
		champion: championOverride || name(places?.champion),
		runnerUp: name(places?.runnerUp),
		third: name(places?.third),
		table: computeStandings(league.teams, league.matches, league.tournament).map((row) => ({
			team: name(row.teamId) ?? '',
			points: row.points,
			played: row.played,
			won: row.won,
			drawn: row.drawn,
			lost: row.lost,
			goalsFor: row.goalsFor,
			goalsAgainst: row.goalsAgainst
		})),
		scorers: topScorers(computePlayerStats(league.teams, league.matches))
			.slice(0, 10)
			.map((stat) => ({ name: stat.name, team: name(stat.teamId) ?? '', goals: stat.goals })),
		results: league.matches
			.filter((match) => match.status === 'finished')
			.map((match) => ({
				stage: match.stage,
				home: name(match.homeTeamId) ?? '',
				away: name(match.awayTeamId) ?? '',
				homeScore: match.homeScore,
				awayScore: match.awayScore,
				walkover: match.forfeitedBy !== null
			}))
	};
}
