/**
 * Draws teams at random from a list of people, for cups where players sign up on their own.
 *
 * The strongest players can be marked as seeded: they are dealt out first, one per team, so no
 * team ends up with all of them.
 */
import { shuffled, type Rng } from './random.ts';
import { distributeEvenly } from './schedule.ts';

export interface DrawPerson {
	name: string;
	number: string | null;
	/** One of the best players, to be kept apart from the other seeded players. */
	seeded: boolean;
}

export const MIN_TEAM_SIZE = 3;

/** The most teams that can be made while every team still has enough players. */
export function maxTeamCount(peopleCount: number): number {
	return Math.floor(peopleCount / MIN_TEAM_SIZE);
}

/** How many players each team gets, larger teams first: 20 people in 6 teams is 4, 4, 3, 3, 3, 3. */
export function teamSizes(peopleCount: number, teamCount: number): number[] {
	return distributeEvenly(peopleCount, teamCount);
}

/** "2 equipos de 4 y 4 de 3" */
export function describeTeamSizes(sizes: readonly number[]): string {
	const groups = new Map<number, number>();
	for (const size of sizes) groups.set(size, (groups.get(size) ?? 0) + 1);
	const parts = [...groups.entries()]
		.sort(([a], [b]) => b - a)
		.map(([size, count], index) =>
			index === 0
				? `${count} ${count === 1 ? 'equipo' : 'equipos'} de ${size}`
				: `${count} de ${size}`
		);
	return parts.join(' y ');
}

/**
 * Splits the people into `teamCount` teams whose sizes differ by one at most. Seeded players are
 * spread first, then everyone else fills the smallest teams, favouring the ones with fewer seeds.
 */
export function drawTeams(
	people: readonly DrawPerson[],
	teamCount: number,
	rng: Rng = Math.random
): DrawPerson[][] {
	if (!Number.isInteger(teamCount) || teamCount < 1) {
		throw new RangeError('There must be at least one team');
	}
	if (people.length < teamCount * MIN_TEAM_SIZE) {
		throw new RangeError(`Each team needs at least ${MIN_TEAM_SIZE} players`);
	}

	const teams: DrawPerson[][] = Array.from({ length: teamCount }, () => []);
	const seedCount = (team: DrawPerson[]) => team.filter((person) => person.seeded).length;

	// Dealing the seeds over a shuffled order of teams keeps the draw from always favouring the
	// first teams when there are more teams than seeds.
	const order = shuffled(teams, rng);
	shuffled(
		people.filter((person) => person.seeded),
		rng
	).forEach((person, index) => order[index % teamCount].push(person));

	for (const person of shuffled(
		people.filter((candidate) => !candidate.seeded),
		rng
	)) {
		const smallest = order.reduce((best, team) => {
			const difference = team.length - best.length || seedCount(team) - seedCount(best);
			return difference < 0 ? team : best;
		});
		smallest.push(person);
	}

	return teams;
}
