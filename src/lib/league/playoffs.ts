/**
 * The knockout rounds that can follow the league: a final between the top two, or semifinals
 * (first against fourth, second against third) and a final. The better-placed team plays at home
 * and goes through on a draw, so finishing high in the table is worth something.
 */
import { champion, computeStandings } from './standings.ts';
import type { KnockoutStage, League, Match } from './types.ts';

export interface PlayoffRound {
	stage: KnockoutStage;
	pairs: { homeId: number; awayId: number }[];
}

/** What the knockout phase needs next: a round to set up, a reason to wait, or nothing. */
export type NextPlayoffStep = { round: PlayoffRound } | { waiting: string } | null;

/** The team that goes through: the winner, or the home team, the better placed, on a draw. */
export function knockoutWinner(match: Match): number {
	return match.awayScore > match.homeScore ? match.awayTeamId : match.homeTeamId;
}

export function knockoutLoser(match: Match): number {
	return knockoutWinner(match) === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
}

function positions(league: League): Map<number, number> {
	const table = computeStandings(league.teams, league.matches, league.tournament);
	return new Map(table.map((row, index) => [row.teamId, index]));
}

export function nextPlayoffRound(league: League): NextPlayoffStep {
	const format = league.tournament.playoff;
	if (format === 'none') return null;

	const leagueMatches = league.matches.filter((match) => match.stage === 'league');
	if (leagueMatches.length === 0) return { waiting: 'Primero arma el calendario de la liga.' };
	if (leagueMatches.some((match) => match.status !== 'finished')) {
		return { waiting: 'La fase final se arma cuando terminen todos los partidos de la liga.' };
	}
	if (league.matches.some((match) => match.stage === 'final')) return null;

	const table = computeStandings(league.teams, league.matches, league.tournament);
	const seed = (index: number) => table[index].teamId;

	if (format === 'final') {
		if (table.length < 2) return { waiting: 'La final necesita al menos 2 equipos.' };
		return { round: { stage: 'final', pairs: [{ homeId: seed(0), awayId: seed(1) }] } };
	}

	if (table.length < 4) return { waiting: 'Las semifinales necesitan al menos 4 equipos.' };
	const semifinals = league.matches.filter((match) => match.stage === 'semifinal');
	if (semifinals.length === 0) {
		return {
			round: {
				stage: 'semifinal',
				pairs: [
					{ homeId: seed(0), awayId: seed(3) },
					{ homeId: seed(1), awayId: seed(2) }
				]
			}
		};
	}
	if (semifinals.some((match) => match.status !== 'finished')) {
		return { waiting: 'La final se arma cuando terminen las dos semifinales.' };
	}
	const order = positions(league);
	const [first, second] = semifinals
		.map(knockoutWinner)
		.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
	return { round: { stage: 'final', pairs: [{ homeId: first, awayId: second }] } };
}

export interface Podium {
	champion: number;
	runnerUp: number | null;
	third: number | null;
}

/**
 * Champion, runner-up and third place once the tournament is over. With a final, the final
 * decides the first two and the better-placed losing semifinalist is third.
 */
export function podium(league: League): Podium | null {
	if (league.tournament.playoff === 'none') {
		const winner = champion(league);
		if (!winner) return null;
		const table = computeStandings(league.teams, league.matches, league.tournament);
		return {
			champion: winner.teamId,
			runnerUp: table[1]?.teamId ?? null,
			third: table[2]?.teamId ?? null
		};
	}
	const final = league.matches.find((match) => match.stage === 'final');
	if (!final || final.status !== 'finished') return null;
	const order = positions(league);
	const semifinalLosers = league.matches
		.filter((match) => match.stage === 'semifinal' && match.status === 'finished')
		.map(knockoutLoser)
		.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
	const table = computeStandings(league.teams, league.matches, league.tournament);
	const finalists = new Set([final.homeTeamId, final.awayTeamId]);
	const third =
		semifinalLosers[0] ?? table.find((row) => !finalists.has(row.teamId))?.teamId ?? null;
	return { champion: knockoutWinner(final), runnerUp: knockoutLoser(final), third };
}
