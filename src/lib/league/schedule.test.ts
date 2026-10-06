import { describe, expect, it } from 'vitest';
import {
	buildRounds,
	buildSchedule,
	dayCapacity,
	dayDurationMinutes,
	dayEndTime,
	distributeByRounds,
	distributeEvenly,
	gamesPerTeamByDay,
	isScheduleOutdated,
	matchesPerRound,
	planOptions,
	roundsPerLeg,
	slotTime,
	totalMatches,
	type PlanTiming,
	type Rng,
	type ScheduledMatch
} from './schedule.ts';

const timing: PlanTiming = {
	startTime: '09:00',
	endTime: '13:00',
	matchMinutes: 20,
	breakMinutes: 5
};

function teams(count: number): number[] {
	return Array.from({ length: count }, (_, index) => index + 1);
}

/** Small deterministic generator so the random draws are reproducible in tests. */
function seededRng(seed: number): Rng {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

function pairKey(a: number, b: number): string {
	return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function recommended(teamCount: number, dayCount = 4) {
	return planOptions(teamCount, dayCount, timing).find((option) => option.recommended);
}

describe('round counts', () => {
	it('needs one round less than the number of teams when it is even', () => {
		expect(roundsPerLeg(6)).toBe(5);
		expect(matchesPerRound(6)).toBe(3);
		expect(totalMatches(6, 1)).toBe(15);
	});

	it('needs as many rounds as teams when it is odd, with one team resting', () => {
		expect(roundsPerLeg(5)).toBe(5);
		expect(matchesPerRound(5)).toBe(2);
		expect(totalMatches(5, 2)).toBe(20);
	});

	it('has nothing to schedule with fewer than two teams', () => {
		expect(roundsPerLeg(1)).toBe(0);
		expect(totalMatches(1, 2)).toBe(0);
		expect(buildRounds([7], 2)).toEqual([]);
	});
});

describe('buildRounds', () => {
	it.each(teams(15).slice(1))('pairs every team once per leg with %i teams', (teamCount) => {
		const rounds = buildRounds(teams(teamCount), 1);
		expect(rounds).toHaveLength(roundsPerLeg(teamCount));

		const meetings = new Map<string, number>();
		for (const round of rounds) {
			expect(round).toHaveLength(matchesPerRound(teamCount));
			const playing = round.flatMap((pairing) => [pairing.homeId, pairing.awayId]);
			expect(new Set(playing).size).toBe(playing.length);
			for (const pairing of round) {
				const key = pairKey(pairing.homeId, pairing.awayId);
				meetings.set(key, (meetings.get(key) ?? 0) + 1);
			}
		}
		expect(meetings.size).toBe(totalMatches(teamCount, 1));
		expect([...meetings.values()].every((count) => count === 1)).toBe(true);
	});

	it.each(teams(15).slice(1))('balances home and away matches with %i teams', (teamCount) => {
		const balance = new Map<number, number>();
		for (const pairing of buildRounds(teams(teamCount), 1).flat()) {
			balance.set(pairing.homeId, (balance.get(pairing.homeId) ?? 0) + 1);
			balance.set(pairing.awayId, (balance.get(pairing.awayId) ?? 0) - 1);
		}
		const worst = Math.max(...[...balance.values()].map(Math.abs));
		expect(worst).toBeLessThanOrEqual(1);
	});

	it('swaps home and away on the second leg', () => {
		const rounds = buildRounds(teams(4), 2);
		expect(rounds).toHaveLength(6);
		const [firstLeg, secondLeg] = [rounds.slice(0, 3).flat(), rounds.slice(3).flat()];
		expect(secondLeg.map((p) => `${p.homeId}-${p.awayId}`)).toEqual(
			firstLeg.map((p) => `${p.awayId}-${p.homeId}`)
		);
		expect(secondLeg.every((pairing) => pairing.leg === 2)).toBe(true);
	});

	it('numbers rounds consecutively across legs', () => {
		const rounds = buildRounds(teams(5), 2);
		expect(rounds.map((round) => round[0].round)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	it('draws a different but still complete calendar with a random generator', () => {
		const fixed = buildRounds(teams(6), 1).flat();
		const drawn = buildRounds(teams(6), 1, seededRng(42)).flat();
		const order = (pairings: typeof fixed) => pairings.map((p) => pairKey(p.homeId, p.awayId));

		expect(order(drawn)).not.toEqual(order(fixed));
		expect([...order(drawn)].sort()).toEqual([...order(fixed)].sort());
		expect(order(buildRounds(teams(6), 1, seededRng(42)).flat())).toEqual(order(drawn));
	});
});

describe('distributing matches over the days', () => {
	it('spreads matches evenly, giving the remainder to the first days', () => {
		expect(distributeEvenly(30, 4)).toEqual([8, 8, 7, 7]);
		expect(distributeEvenly(28, 4)).toEqual([7, 7, 7, 7]);
		expect(distributeEvenly(3, 4)).toEqual([1, 1, 1, 0]);
	});

	it('keeps whole rounds together when there are enough rounds', () => {
		expect(distributeByRounds(6, 2, 4)).toEqual([9, 9, 6, 6]);
		expect(distributeByRounds(8, 1, 4)).toEqual([8, 8, 8, 4]);
		expect(distributeByRounds(4, 4, 4)).toEqual([6, 6, 6, 6]);
	});

	it('cannot keep whole rounds when there are fewer rounds than days', () => {
		expect(distributeByRounds(4, 1, 4)).toBeNull();
	});
});

describe('timing', () => {
	it('counts how many matches fit in the time window', () => {
		expect(dayCapacity(timing)).toBe(9);
		expect(dayCapacity({ ...timing, endTime: '09:20' })).toBe(1);
		expect(dayCapacity({ ...timing, endTime: '09:10' })).toBe(0);
		expect(dayCapacity({ ...timing, endTime: '08:00' })).toBe(0);
	});

	it('does not count a break after the last match', () => {
		expect(dayDurationMinutes(9, timing)).toBe(220);
		expect(dayDurationMinutes(1, timing)).toBe(20);
		expect(dayDurationMinutes(0, timing)).toBe(0);
		expect(dayEndTime(9, timing)).toBe('12:40');
	});

	it('spaces kick-offs by match length plus break', () => {
		expect(slotTime(0, timing)).toBe('09:00');
		expect(slotTime(1, timing)).toBe('09:25');
		expect(slotTime(8, timing)).toBe('12:20');
	});
});

describe('planOptions', () => {
	it('describes one to eight legs', () => {
		const options = planOptions(6, 4, timing);
		expect(options.map((option) => option.legs)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(options.filter((option) => option.recommended)).toHaveLength(1);
	});

	it('has room for eight legs when four teams play short matches back to back', () => {
		const evening = { startTime: '19:30', endTime: '21:30', matchMinutes: 10, breakMinutes: 0 };
		const options = planOptions(4, 4, evening);
		expect(options.find((option) => option.legs === 8)).toMatchObject({
			totalMatches: 48,
			matchesPerDay: [12, 12, 12, 12],
			gamesPerTeamPerDay: 6,
			longestDayMinutes: 120,
			fits: true
		});
		expect(options.find((option) => option.recommended)).toMatchObject({ legs: 4 });
	});

	it('recommends two legs for six teams over four days', () => {
		expect(recommended(6)).toMatchObject({
			legs: 2,
			totalMatches: 30,
			matchesPerDay: [9, 9, 6, 6],
			distribution: 'rounds',
			gamesPerTeam: 10,
			fits: true
		});
	});

	it('recommends a single leg when two would not fit in the day', () => {
		expect(recommended(8)).toMatchObject({ legs: 1, matchesPerDay: [8, 8, 8, 4], fits: true });
		expect(recommended(7)).toMatchObject({ legs: 1, matchesPerDay: [6, 6, 6, 3], fits: true });
	});

	it('prefers equally long days when several formats give enough play', () => {
		expect(recommended(4)).toMatchObject({ legs: 4, matchesPerDay: [6, 6, 6, 6] });
	});

	it('spreads matches evenly when whole rounds would overflow a day', () => {
		expect(recommended(9)).toMatchObject({
			legs: 1,
			matchesPerDay: [9, 9, 9, 9],
			distribution: 'even',
			fits: true
		});
	});

	it('still recommends the shortest format when nothing fits', () => {
		expect(recommended(12)).toMatchObject({ legs: 1, fits: false });
	});

	it('has no options without at least two teams and one day', () => {
		expect(planOptions(1, 4, timing)).toEqual([]);
		expect(planOptions(6, 0, timing)).toEqual([]);
	});
});

describe('buildSchedule', () => {
	function byDay(schedule: ScheduledMatch[], dayCount: number): ScheduledMatch[][] {
		return Array.from({ length: dayCount }, (_, dayIndex) =>
			schedule.filter((match) => match.dayIndex === dayIndex).sort((a, b) => a.slot - b.slot)
		);
	}

	it('puts the requested number of matches on each day, in consecutive slots', () => {
		const schedule = buildSchedule({ teamIds: teams(6), legs: 2, matchesPerDay: [9, 9, 6, 6] });
		const days = byDay(schedule, 4);
		expect(days.map((day) => day.length)).toEqual([9, 9, 6, 6]);
		for (const day of days) {
			expect(day.map((match) => match.slot)).toEqual(day.map((_, index) => index));
		}
	});

	it('schedules every pairing exactly once per leg', () => {
		const schedule = buildSchedule({ teamIds: teams(7), legs: 2, matchesPerDay: [11, 11, 10, 10] });
		const fixtures = schedule.map((match) => `${match.homeId}-${match.awayId}`);
		expect(new Set(fixtures).size).toBe(42);
		for (const match of schedule) {
			expect(fixtures).toContain(`${match.awayId}-${match.homeId}`);
		}
	});

	it('gives every team the same number of matches per day when rounds are kept whole', () => {
		const ids = teams(6);
		const schedule = buildSchedule({ teamIds: ids, legs: 2, matchesPerDay: [9, 9, 6, 6] });
		byDay(schedule, 4).forEach((day, dayIndex) => {
			const expected = [3, 3, 2, 2][dayIndex];
			for (const id of ids) {
				const games = day.filter((match) => match.homeId === id || match.awayId === id);
				expect(games).toHaveLength(expected);
			}
		});
	});

	it.each([6, 8, 10])('never makes a team play back to back with %i teams', (teamCount) => {
		const matchesPerDay = distributeByRounds(teamCount, 2, 4) as number[];
		const schedule = buildSchedule({ teamIds: teams(teamCount), legs: 2, matchesPerDay });
		for (const day of byDay(schedule, 4)) {
			for (let slot = 1; slot < day.length; slot++) {
				const previous = [day[slot - 1].homeId, day[slot - 1].awayId];
				expect(previous).not.toContain(day[slot].homeId);
				expect(previous).not.toContain(day[slot].awayId);
			}
		}
	});

	it('keeps days balanced when a round is split between two of them', () => {
		const ids = teams(6);
		const schedule = buildSchedule({ teamIds: ids, legs: 2, matchesPerDay: [8, 8, 7, 7] });
		for (const day of byDay(schedule, 4)) {
			const games = ids.map(
				(id) => day.filter((match) => match.homeId === id || match.awayId === id).length
			);
			expect(Math.max(...games) - Math.min(...games)).toBeLessThanOrEqual(1);
		}
	});

	it('plays rounds in order', () => {
		const schedule = buildSchedule({ teamIds: teams(6), legs: 1, matchesPerDay: [4, 4, 4, 3] });
		const rounds = schedule.map((match) => match.round);
		expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
	});

	it('allows days without matches', () => {
		const schedule = buildSchedule({ teamIds: teams(4), legs: 1, matchesPerDay: [6, 0, 0, 0] });
		expect(schedule.every((match) => match.dayIndex === 0)).toBe(true);
	});

	it('draws a reproducible calendar from a random generator', () => {
		const input = { teamIds: teams(6), legs: 1, matchesPerDay: [4, 4, 4, 3] };
		const first = buildSchedule({ ...input, rng: seededRng(7) });
		const second = buildSchedule({ ...input, rng: seededRng(7) });
		expect(second).toEqual(first);
		expect(first).not.toEqual(buildSchedule(input));
	});

	it('rejects a plan that does not add up to the total number of matches', () => {
		expect(() =>
			buildSchedule({ teamIds: teams(6), legs: 1, matchesPerDay: [4, 4, 4, 4] })
		).toThrow(RangeError);
		expect(() => buildSchedule({ teamIds: teams(4), legs: 1, matchesPerDay: [7, -1] })).toThrow(
			RangeError
		);
	});
});

describe('isScheduleOutdated', () => {
	const ids = teams(4);
	const matches = buildSchedule({ teamIds: ids, legs: 1, matchesPerDay: [6] }).map((match) => ({
		homeTeamId: match.homeId,
		awayTeamId: match.awayId
	}));

	it('is up to date right after generating', () => {
		expect(isScheduleOutdated(ids, 1, matches)).toBe(false);
	});

	it('is never outdated while there is no calendar', () => {
		expect(isScheduleOutdated(ids, 1, [])).toBe(false);
	});

	it('is outdated once a team joins or leaves', () => {
		expect(isScheduleOutdated([...ids, 5], 1, matches)).toBe(true);
		const withoutFourth = matches.filter((m) => m.homeTeamId !== 4 && m.awayTeamId !== 4);
		expect(isScheduleOutdated(ids.slice(0, 3), 1, withoutFourth)).toBe(false);
		expect(isScheduleOutdated(ids, 1, withoutFourth)).toBe(true);
	});
});

describe('gamesPerTeamByDay', () => {
	it('counts the matches of each team on each day', () => {
		const table = gamesPerTeamByDay(
			[1, 2, 3],
			[10, 20],
			[
				{ matchDayId: 10, homeTeamId: 1, awayTeamId: 2 },
				{ matchDayId: 10, homeTeamId: 3, awayTeamId: 1 },
				{ matchDayId: 20, homeTeamId: 2, awayTeamId: 3 }
			]
		);
		expect(table.get(1)).toEqual([2, 0]);
		expect(table.get(2)).toEqual([1, 1]);
		expect(table.get(3)).toEqual([1, 1]);
	});
});
