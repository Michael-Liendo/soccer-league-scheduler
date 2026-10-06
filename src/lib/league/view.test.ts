import { describe, expect, it } from 'vitest';
import type { Match, MatchEventType, Team } from './types.ts';
import { eventsByPlayer, goalsLabel, rosterLine } from './view.ts';

/** A team whose players are given as `[name, shirt number]`, or just the name. */
function team(...players: (string | [string, string])[]): Team {
	return {
		id: 1,
		name: 'Los Tiburones',
		color: '#1f9d55',
		players: players.map((player, index) => ({
			id: index + 1,
			teamId: 1,
			name: typeof player === 'string' ? player : player[0],
			number: typeof player === 'string' ? null : player[1],
			position: null
		}))
	};
}

describe('rosterLine', () => {
	it('names the players in roster order', () => {
		expect(rosterLine(team('Pedro', ['Luis', '10'], 'Ana'))).toBe('Luis · Ana · Pedro');
	});

	it('counts the rest of a large squad instead of naming everyone', () => {
		const squad = team('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I');
		expect(rosterLine(squad)).toBe('A · B · C · D · E · F y 3 más');
		expect(rosterLine(squad, 2)).toBe('A · B y 7 más');
	});

	it('names everyone when only one player would be left out', () => {
		expect(rosterLine(team('A', 'B', 'C', 'D', 'E', 'F', 'G'))).toBe('A · B · C · D · E · F · G');
	});

	it('is empty without a team or without players', () => {
		expect(rosterLine(undefined)).toBe('');
		expect(rosterLine(team())).toBe('');
	});
});

describe('what each player did in a match', () => {
	const side = team('Ana', 'Luis');
	const [ana, luis] = side.players;

	/** A match of `side` with the given events, each `[player id, type, minute]`. */
	function match(...events: [number | null, MatchEventType, number | null][]): Match {
		return {
			id: 1,
			matchDayId: 1,
			round: 1,
			leg: 1,
			slot: 0,
			time: null,
			venue: null,
			homeTeamId: side.id,
			awayTeamId: 2,
			status: 'live',
			homeScore: 0,
			awayScore: 0,
			clockStartedAt: null,
			clockElapsedMs: 0,
			forfeitedBy: null,
			events: events.map(([playerId, type, minute], index) => ({
				id: index + 1,
				matchId: 1,
				teamId: side.id,
				playerId,
				playerName: '',
				type,
				minute
			}))
		};
	}

	it('lists the minute of every goal, marking the ones that counted double', () => {
		const [scorer] = eventsByPlayer(match([ana.id, 'goal', 3], [ana.id, 'double_goal', 7]), side);
		expect(scorer).toMatchObject({ name: 'Ana', goals: 3 });
		expect(goalsLabel(scorer)).toBe("3', 7' ×2");
	});

	it('falls back to the number of goals when one of them was not timed', () => {
		const [scorer] = eventsByPlayer(
			match([ana.id, 'double_goal', 7], [ana.id, 'goal', null]),
			side
		);
		expect(goalsLabel(scorer)).toBe('×3');
	});

	it('counts each kind of card on its own', () => {
		const players = eventsByPlayer(
			match([luis.id, 'yellow', 2], [luis.id, 'blue', 4], [ana.id, 'red', 9]),
			side
		);
		expect(
			players.map((player) => [player.name, player.yellows, player.blues, player.reds])
		).toEqual([
			['Luis', 1, 1, 0],
			['Ana', 0, 0, 1]
		]);
		expect(players.every((player) => goalsLabel(player) === '')).toBe(true);
	});
});
