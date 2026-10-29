import { describe, expect, it } from 'vitest';
import { plannedKnockouts } from './playoffs.ts';
import type { League, Match, PlayoffFormat } from './types.ts';

function match(
	id: number,
	slot: number,
	home: number,
	away: number,
	extra: Partial<Match> = {}
): Match {
	return {
		id,
		matchDayId: 1,
		round: 1,
		leg: 1,
		slot,
		time: null,
		venue: null,
		homeTeamId: home,
		awayTeamId: away,
		status: 'pending',
		homeScore: 0,
		awayScore: 0,
		clockStartedAt: null,
		clockElapsedMs: 0,
		forfeitedBy: null,
		stage: 'league',
		events: [],
		...extra
	};
}

function league(playoff: PlayoffFormat, matches: Match[]): League {
	return {
		tournament: {
			name: 'Copa',
			location: '',
			venue: '',
			playersOnField: 3,
			cards: ['yellow'],
			doubleGoals: false,
			playoff,
			registrationOpen: false,
			pointsWin: 3,
			pointsDraw: 1,
			pointsLoss: 0,
			legs: 1,
			rounds: 0,
			startTime: '19:00',
			endTime: '22:00',
			matchMinutes: 8,
			breakMinutes: 2,
			updatedAt: 0
		},
		matchDays: [{ id: 1, number: 1, date: '2026-10-24' }],
		teams: [1, 2, 3, 4].map((id) => ({ id, name: `Equipo ${id}`, color: '#000', players: [] })),
		matches
	} as League;
}

const leagueMatches = [match(1, 0, 1, 2), match(2, 1, 3, 4)];

describe('plannedKnockouts', () => {
	it('shows the semifinals and the final after the last league match', () => {
		const planned = plannedKnockouts(league('semifinals', leagueMatches));
		expect(planned.map(({ stage, home, away, time }) => [stage, home, away, time])).toEqual([
			['semifinal', '1.º de la tabla', '4.º de la tabla', '19:20'],
			['semifinal', '2.º de la tabla', '3.º de la tabla', '19:30'],
			['final', 'Ganador semifinal 1', 'Ganador semifinal 2', '19:40']
		]);
	});

	it('shows only the final once the semifinals are set up, naming the teams through', () => {
		const semis = [
			match(3, 2, 1, 4, { stage: 'semifinal', status: 'finished', homeScore: 0, awayScore: 2 }),
			match(4, 3, 2, 3, { stage: 'semifinal' })
		];
		const planned = plannedKnockouts(league('semifinals', [...leagueMatches, ...semis]));
		expect(planned).toHaveLength(1);
		expect(planned[0]).toMatchObject({
			home: 'Equipo 4',
			away: 'Ganador semifinal 2',
			time: '19:40'
		});
	});

	it('shows the final between the top two when there are no semifinals', () => {
		expect(plannedKnockouts(league('final', leagueMatches))).toMatchObject([
			{ stage: 'final', home: '1.º de la tabla', away: '2.º de la tabla' }
		]);
	});

	it('shows nothing without a knockout phase, a schedule, or once the final is set up', () => {
		expect(plannedKnockouts(league('none', leagueMatches))).toEqual([]);
		expect(plannedKnockouts(league('semifinals', []))).toEqual([]);
		const final = match(5, 2, 1, 2, { stage: 'final' });
		expect(plannedKnockouts(league('final', [...leagueMatches, final]))).toEqual([]);
	});
});
