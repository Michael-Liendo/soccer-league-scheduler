import { describe, expect, it } from 'vitest';
import { describeTeamSizes, drawTeams, maxTeamCount, teamSizes, type DrawPerson } from './draw.ts';
import type { Rng } from './random.ts';

function seededRng(seed: number): Rng {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

/** `count` people, the first `seeds` of them marked as the best players. */
function people(count: number, seeds = 0): DrawPerson[] {
	return Array.from({ length: count }, (_, index) => ({
		name: `Jugador ${index + 1}`,
		number: null,
		seeded: index < seeds
	}));
}

describe('team sizes', () => {
	it('allows as many teams as keep three players each', () => {
		expect(maxTeamCount(20)).toBe(6);
		expect(maxTeamCount(9)).toBe(3);
		expect(maxTeamCount(5)).toBe(1);
	});

	it('spreads everyone with at most one player of difference', () => {
		expect(teamSizes(20, 6)).toEqual([4, 4, 3, 3, 3, 3]);
		expect(teamSizes(24, 8)).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
	});

	it('describes the sizes in words', () => {
		expect(describeTeamSizes([4, 4, 3, 3, 3, 3])).toBe('2 equipos de 4 y 4 de 3');
		expect(describeTeamSizes([3, 3, 3])).toBe('3 equipos de 3');
		expect(describeTeamSizes([5, 4])).toBe('1 equipo de 5 y 1 de 4');
	});
});

describe('drawTeams', () => {
	it.each([
		[20, 6],
		[24, 8],
		[13, 4],
		[9, 3],
		[31, 7]
	])('places each of %i people in one of %i teams', (count, teamCount) => {
		const everyone = people(count, 5);
		const teams = drawTeams(everyone, teamCount, seededRng(count));

		expect(teams).toHaveLength(teamCount);
		const placed = teams.flat().map((person) => person.name);
		expect([...placed].sort()).toEqual(everyone.map((person) => person.name).sort());

		const sizes = teams.map((team) => team.length);
		expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
		expect(Math.min(...sizes)).toBeGreaterThanOrEqual(3);
	});

	it('never puts two of the best players together while there is a team without one', () => {
		for (let seed = 1; seed <= 25; seed++) {
			const teams = drawTeams(people(20, 6), 6, seededRng(seed));
			expect(teams.map((team) => team.filter((person) => person.seeded).length)).toEqual([
				1, 1, 1, 1, 1, 1
			]);
		}
	});

	it('shares out the best players evenly when there are more of them than teams', () => {
		for (let seed = 1; seed <= 25; seed++) {
			const seeds = drawTeams(people(20, 9), 4, seededRng(seed)).map(
				(team) => team.filter((person) => person.seeded).length
			);
			expect(Math.max(...seeds) - Math.min(...seeds)).toBeLessThanOrEqual(1);
		}
	});

	it('gives the spare players to teams without a seeded player first', () => {
		for (let seed = 1; seed <= 25; seed++) {
			// 14 people in 4 teams: two teams of 4. With two seeds, those are the unseeded teams.
			const teams = drawTeams(people(14, 2), 4, seededRng(seed));
			for (const team of teams.filter((candidate) => candidate.length === 4)) {
				expect(team.some((person) => person.seeded)).toBe(false);
			}
		}
	});

	it('gives a different draw each time, and the same one for the same random numbers', () => {
		const everyone = people(18, 3);
		const names = (teams: DrawPerson[][]) => teams.map((team) => team.map((p) => p.name));
		expect(names(drawTeams(everyone, 6, seededRng(1)))).toEqual(
			names(drawTeams(everyone, 6, seededRng(1)))
		);
		expect(names(drawTeams(everyone, 6, seededRng(1)))).not.toEqual(
			names(drawTeams(everyone, 6, seededRng(2)))
		);
	});

	it('refuses to make teams of fewer than three', () => {
		expect(() => drawTeams(people(8), 3)).toThrow(RangeError);
		expect(() => drawTeams(people(8), 0)).toThrow(RangeError);
	});
});
