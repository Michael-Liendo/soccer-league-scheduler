import { describe, expect, it } from 'vitest';
import type { Team } from './types.ts';
import { rosterLine } from './view.ts';

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
