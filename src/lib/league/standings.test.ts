import { describe, expect, it } from 'vitest';
import {
	cardedPlayers,
	champion,
	computePlayerStats,
	computeStandings,
	defenseTable,
	fairPlayTable,
	topScorers
} from './standings.ts';
import type {
	League,
	Match,
	MatchEvent,
	MatchEventType,
	MatchStatus,
	Team,
	Tournament
} from './types.ts';

const scoring = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };

const teams: Team[] = [
	{
		id: 1,
		name: 'Tiburones',
		color: '#16a34a',
		players: [
			{ id: 11, teamId: 1, name: 'Luis', number: '10', position: 'FWD' },
			{ id: 12, teamId: 1, name: 'Carlos', number: '1', position: 'GK' }
		]
	},
	{
		id: 2,
		name: 'Camurí',
		color: '#dc2626',
		players: [{ id: 21, teamId: 2, name: 'Pedro', number: '9', position: 'FWD' }]
	},
	{ id: 3, name: 'La Planta', color: '#2563eb', players: [] }
];

let nextId = 1;

function event(
	teamId: number,
	playerId: number | null,
	type: MatchEventType,
	name = ''
): MatchEvent {
	return { id: nextId++, matchId: 0, teamId, playerId, playerName: name, type, minute: null };
}

function match(
	homeTeamId: number,
	awayTeamId: number,
	score: [number, number] | null,
	events: MatchEvent[] = [],
	status: MatchStatus = score ? 'finished' : 'pending'
): Match {
	return {
		id: nextId++,
		matchDayId: 1,
		round: 1,
		leg: 1,
		slot: 0,
		time: null,
		venue: null,
		homeTeamId,
		awayTeamId,
		status,
		homeScore: score?.[0] ?? 0,
		awayScore: score?.[1] ?? 0,
		clockStartedAt: null,
		clockElapsedMs: 0,
		events
	};
}

describe('computeStandings', () => {
	it('lists every team with zeros before any match is played', () => {
		const table = computeStandings(teams, [match(1, 2, null)], scoring);
		expect(table).toHaveLength(3);
		expect(table.every((row) => row.played === 0 && row.points === 0)).toBe(true);
	});

	it('awards three points for a win and one for a draw', () => {
		const table = computeStandings(teams, [match(1, 2, [2, 1]), match(2, 3, [0, 0])], scoring);
		const byTeam = new Map(table.map((row) => [row.teamId, row]));
		expect(byTeam.get(1)).toMatchObject({ played: 1, won: 1, points: 3, goalDifference: 1 });
		expect(byTeam.get(2)).toMatchObject({ played: 2, drawn: 1, lost: 1, points: 1 });
		expect(byTeam.get(3)).toMatchObject({ played: 1, drawn: 1, points: 1, goalsFor: 0 });
		expect(table.map((row) => row.teamId)).toEqual([1, 3, 2]);
	});

	it('ignores matches that are still being played', () => {
		const table = computeStandings(teams, [match(1, 2, [3, 0], [], 'live')], scoring);
		expect(table.every((row) => row.played === 0)).toBe(true);
	});

	it('uses the points configured for the tournament', () => {
		const table = computeStandings(teams, [match(1, 2, [1, 0])], {
			pointsWin: 2,
			pointsDraw: 1,
			pointsLoss: 0
		});
		expect(table[0]).toMatchObject({ teamId: 1, points: 2 });
	});

	it('breaks ties on goal difference and then on goals scored', () => {
		const table = computeStandings(
			teams,
			[match(1, 3, [1, 0]), match(2, 3, [3, 1]), match(1, 2, [2, 2]), match(3, 1, [0, 1])],
			scoring
		);
		// Tiburones 7 points; Camurí 4 points (+2); La Planta 0.
		expect(table.map((row) => [row.teamId, row.points])).toEqual([
			[1, 7],
			[2, 4],
			[3, 0]
		]);

		const level = computeStandings(teams, [match(1, 3, [2, 1]), match(2, 3, [1, 0])], scoring);
		// Both won by one goal, but Tiburones scored more.
		expect(level.map((row) => row.teamId)).toEqual([1, 2, 3]);
	});

	it('puts the cleaner team first when everything else is level', () => {
		const matches = [match(1, 3, [1, 0], [event(1, 11, 'yellow')]), match(2, 3, [1, 0])];
		expect(computeStandings(teams, matches, scoring).map((row) => row.teamId)).toEqual([2, 1, 3]);
	});

	it('keeps the results of each team in the order they were played', () => {
		const table = computeStandings(
			teams,
			[match(1, 2, [1, 0]), match(1, 3, [0, 0]), match(2, 1, [2, 0])],
			scoring
		);
		expect(table.find((row) => row.teamId === 1)?.form).toEqual(['W', 'D', 'L']);
	});
});

describe('player statistics', () => {
	const matches = [
		match(
			1,
			2,
			[2, 1],
			[
				event(1, 11, 'goal'),
				event(1, 11, 'goal'),
				event(2, 21, 'goal'),
				event(2, 21, 'yellow'),
				event(1, 12, 'red')
			]
		),
		match(1, 3, [1, 0], [event(1, 11, 'goal'), event(3, null, 'yellow', 'Invitado')], 'live')
	];
	const stats = computePlayerStats(teams, matches);

	it('adds up goals and cards per player, including matches in play', () => {
		expect(stats.find((stat) => stat.playerId === 11)).toMatchObject({
			name: 'Luis',
			number: '10',
			teamId: 1,
			goals: 3
		});
		expect(stats.find((stat) => stat.playerId === 21)).toMatchObject({ goals: 1, yellows: 1 });
	});

	it('keeps players who are no longer on a roster under their recorded name', () => {
		expect(stats.find((stat) => stat.name === 'Invitado')).toMatchObject({
			playerId: null,
			teamId: 3,
			yellows: 1
		});
	});

	it('credits own goals and goals without a named scorer to nobody', () => {
		const withOwnGoal = computePlayerStats(teams, [
			match(
				1,
				2,
				[3, 0],
				[event(1, 11, 'goal'), event(1, null, 'own_goal'), event(1, null, 'goal')]
			)
		]);
		expect(withOwnGoal).toHaveLength(1);
		expect(withOwnGoal[0]).toMatchObject({ playerId: 11, goals: 1 });
	});

	it('ranks scorers by goals', () => {
		expect(topScorers(stats).map((stat) => [stat.name, stat.goals])).toEqual([
			['Luis', 3],
			['Pedro', 1]
		]);
	});

	it('lists carded players with reds weighing more than yellows', () => {
		expect(cardedPlayers(stats).map((stat) => stat.name)).toEqual(['Carlos', 'Invitado', 'Pedro']);
	});
});

describe('team statistics', () => {
	const matches = [
		match(1, 2, [2, 0], [event(2, 21, 'yellow'), event(2, 21, 'red')]),
		match(1, 3, [1, 1], [event(1, 11, 'yellow')]),
		match(2, 3, null)
	];

	it('scores fair play with one point per yellow and three per red', () => {
		expect(fairPlayTable(teams, matches)).toEqual([
			{ teamId: 3, yellows: 0, reds: 0, points: 0 },
			{ teamId: 1, yellows: 1, reds: 0, points: 1 },
			{ teamId: 2, yellows: 1, reds: 1, points: 4 }
		]);
	});

	it('does not count goals of any kind against fair play', () => {
		const table = fairPlayTable(teams, [
			match(1, 2, [2, 0], [event(1, 11, 'goal'), event(1, null, 'own_goal')])
		]);
		expect(table.every((row) => row.points === 0)).toBe(true);
	});

	it('orders defences by goals conceded per match', () => {
		expect(defenseTable(teams, matches)).toEqual([
			{ teamId: 1, played: 2, goalsAgainst: 1, goalsAgainstPerMatch: 0.5, cleanSheets: 1 },
			{ teamId: 3, played: 1, goalsAgainst: 1, goalsAgainstPerMatch: 1, cleanSheets: 0 },
			{ teamId: 2, played: 1, goalsAgainst: 2, goalsAgainstPerMatch: 2, cleanSheets: 0 }
		]);
	});
});

describe('champion', () => {
	const tournament = { ...scoring } as Tournament;
	const league = (matches: Match[]): League => ({ tournament, matchDays: [], teams, matches });

	it('is unknown until every match is finished', () => {
		expect(champion(league([]))).toBeNull();
		expect(champion(league([match(1, 2, [1, 0]), match(2, 3, null)]))).toBeNull();
	});

	it('is the team on top of the final table', () => {
		const final = league([match(1, 2, [1, 0]), match(2, 3, [2, 2]), match(3, 1, [0, 3])]);
		expect(champion(final)).toMatchObject({ teamId: 1, points: 6 });
	});
});
