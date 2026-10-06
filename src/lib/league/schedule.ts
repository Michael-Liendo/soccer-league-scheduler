/**
 * Round-robin scheduling for a league played on a single field over a handful of match days.
 *
 * Everything here is pure: the same input always produces the same calendar, unless a random
 * number generator is passed in to draw the fixtures.
 */
import { addMinutes, toMinutes } from './format.ts';
import { shuffled, type Rng } from './random.ts';

export type { Rng };

export interface Pairing {
	/** 1-based round number across all legs. Every team plays at most once per round. */
	round: number;
	/** 1-based leg number. Pairings repeat once per leg, swapping home and away. */
	leg: number;
	homeId: number;
	awayId: number;
}

export interface ScheduledMatch extends Pairing {
	/** 0-based index into the list of match days. */
	dayIndex: number;
	/** 0-based order of the match within its day. */
	slot: number;
}

export interface PlanTiming {
	/** `HH:MM` of the first kick-off of the day. */
	startTime: string;
	/** `HH:MM` by which the last match should be over. */
	endTime: string;
	matchMinutes: number;
	breakMinutes: number;
}

export type Distribution = 'rounds' | 'even';

export interface PlanOption {
	legs: number;
	totalMatches: number;
	totalRounds: number;
	/** Matches each team plays over the whole tournament. */
	gamesPerTeam: number;
	gamesPerTeamPerDay: number;
	matchesPerDay: number[];
	distribution: Distribution;
	longestDayMatches: number;
	longestDayMinutes: number;
	/** Whether the longest day fits between the start and end times. */
	fits: boolean;
	recommended: boolean;
}

export const LEG_OPTIONS = [1, 2, 3, 4] as const;

/** Teams should ideally play between two and three matches per match day. */
const IDEAL_GAMES_PER_DAY = { min: 2, max: 3 };

export function matchesPerRound(teamCount: number): number {
	return Math.floor(teamCount / 2);
}

/** Rounds needed for everyone to meet once. With an odd number of teams one rests each round. */
export function roundsPerLeg(teamCount: number): number {
	if (teamCount < 2) return 0;
	return teamCount % 2 === 0 ? teamCount - 1 : teamCount;
}

export function totalRounds(teamCount: number, legs: number): number {
	return roundsPerLeg(teamCount) * legs;
}

export function totalMatches(teamCount: number, legs: number): number {
	if (teamCount < 2) return 0;
	return ((teamCount * (teamCount - 1)) / 2) * legs;
}

/**
 * Builds every round of the tournament with the circle method: one team stays put while the
 * others rotate around it, so each round pairs everyone exactly once.
 *
 * Passing `rng` draws the fixtures: the team order and the order of the rounds are shuffled.
 */
export function buildRounds(teamIds: readonly number[], legs: number, rng?: Rng): Pairing[][] {
	if (teamIds.length < 2 || legs < 1) return [];

	const seats: (number | null)[] = rng ? shuffled(teamIds, rng) : [...teamIds];
	// With an odd number of teams the fixed seat is left empty: whoever faces it rests that round.
	if (seats.length % 2 === 1) seats.unshift(null);
	const seatCount = seats.length;
	const roundCount = seatCount - 1;

	const baseRounds: { homeId: number; awayId: number }[][] = [];
	for (let round = 0; round < roundCount; round++) {
		const pairings: { homeId: number; awayId: number }[] = [];
		for (let i = 0; i < seatCount / 2; i++) {
			const first = seats[i];
			const second = seats[seatCount - 1 - i];
			if (first === null || second === null) continue;
			// Alternating who hosts keeps home and away matches balanced for every team.
			const swap = i === 0 ? round % 2 === 1 : i % 2 === 1;
			pairings.push(swap ? { homeId: second, awayId: first } : { homeId: first, awayId: second });
		}
		baseRounds.push(pairings);
		seats.splice(1, 0, seats.pop() as number | null);
	}

	const orderedRounds = rng ? shuffled(baseRounds, rng) : baseRounds;

	const rounds: Pairing[][] = [];
	for (let leg = 0; leg < legs; leg++) {
		const swapSides = leg % 2 === 1;
		for (const pairings of orderedRounds) {
			const round = rounds.length + 1;
			rounds.push(
				pairings.map(({ homeId, awayId }) => ({
					round,
					leg: leg + 1,
					homeId: swapSides ? awayId : homeId,
					awayId: swapSides ? homeId : awayId
				}))
			);
		}
	}
	return rounds;
}

/** Splits `total` matches over the days as evenly as possible, earlier days first. */
export function distributeEvenly(total: number, dayCount: number): number[] {
	if (dayCount < 1) return [];
	const base = Math.floor(total / dayCount);
	const extra = total % dayCount;
	return Array.from({ length: dayCount }, (_, index) => base + (index < extra ? 1 : 0));
}

/**
 * Gives every day a whole number of rounds, so all teams play the same amount each day.
 * Returns `null` when there are fewer rounds than days, where that is not possible.
 */
export function distributeByRounds(
	teamCount: number,
	legs: number,
	dayCount: number
): number[] | null {
	const rounds = totalRounds(teamCount, legs);
	if (dayCount < 1 || rounds < dayCount) return null;
	const perRound = matchesPerRound(teamCount);
	return distributeEvenly(rounds, dayCount).map((roundsThatDay) => roundsThatDay * perRound);
}

function slotMinutes(timing: PlanTiming): number {
	return timing.matchMinutes + timing.breakMinutes;
}

/** How many matches fit between the start and end times of a day. */
export function dayCapacity(timing: PlanTiming): number {
	const window = toMinutes(timing.endTime) - toMinutes(timing.startTime);
	if (window < timing.matchMinutes) return 0;
	return Math.floor((window + timing.breakMinutes) / slotMinutes(timing));
}

/** Minutes from the first kick-off to the final whistle of a day with `matchCount` matches. */
export function dayDurationMinutes(matchCount: number, timing: PlanTiming): number {
	if (matchCount < 1) return 0;
	return matchCount * slotMinutes(timing) - timing.breakMinutes;
}

/** Kick-off time of the match in the given 0-based slot. */
export function slotTime(slot: number, timing: PlanTiming): string {
	return addMinutes(timing.startTime, slot * slotMinutes(timing));
}

export function dayEndTime(matchCount: number, timing: PlanTiming): string {
	return addMinutes(timing.startTime, dayDurationMinutes(matchCount, timing));
}

function distanceToIdeal(gamesPerDay: number): number {
	if (gamesPerDay < IDEAL_GAMES_PER_DAY.min) return IDEAL_GAMES_PER_DAY.min - gamesPerDay;
	if (gamesPerDay > IDEAL_GAMES_PER_DAY.max) return gamesPerDay - IDEAL_GAMES_PER_DAY.max;
	return 0;
}

/**
 * Picks how to spread the matches of a format over the days: whole rounds per day when that
 * fits in the time window, otherwise as evenly as possible to keep the longest day short.
 */
export function suggestMatchesPerDay(
	teamCount: number,
	legs: number,
	dayCount: number,
	timing: PlanTiming
): { matchesPerDay: number[]; distribution: Distribution } {
	const capacity = dayCapacity(timing);
	const byRounds = distributeByRounds(teamCount, legs, dayCount);
	if (byRounds && Math.max(...byRounds) <= capacity) {
		return { matchesPerDay: byRounds, distribution: 'rounds' };
	}
	return {
		matchesPerDay: distributeEvenly(totalMatches(teamCount, legs), dayCount),
		distribution: 'even'
	};
}

/**
 * Describes each format (one to four legs) for the given teams and days, and flags the one that
 * gives every team a good amount of play per day while fitting in the time window.
 */
export function planOptions(teamCount: number, dayCount: number, timing: PlanTiming): PlanOption[] {
	if (teamCount < 2 || dayCount < 1) return [];
	const capacity = dayCapacity(timing);

	const options: PlanOption[] = LEG_OPTIONS.map((legs) => {
		const { matchesPerDay, distribution } = suggestMatchesPerDay(teamCount, legs, dayCount, timing);
		const longestDayMatches = Math.max(...matchesPerDay);
		const gamesPerTeam = (teamCount - 1) * legs;
		return {
			legs,
			totalMatches: totalMatches(teamCount, legs),
			totalRounds: totalRounds(teamCount, legs),
			gamesPerTeam,
			gamesPerTeamPerDay: gamesPerTeam / dayCount,
			matchesPerDay,
			distribution,
			longestDayMatches,
			longestDayMinutes: dayDurationMinutes(longestDayMatches, timing),
			fits: longestDayMatches <= capacity,
			recommended: false
		};
	});

	const isEvenAcrossDays = (option: PlanOption) =>
		Math.max(...option.matchesPerDay) === Math.min(...option.matchesPerDay);

	const fitting = options.filter((option) => option.fits);
	const best =
		fitting.length === 0
			? options[0]
			: [...fitting].sort(
					(a, b) =>
						distanceToIdeal(a.gamesPerTeamPerDay) - distanceToIdeal(b.gamesPerTeamPerDay) ||
						Number(isEvenAcrossDays(b)) - Number(isEvenAcrossDays(a)) ||
						a.legs - b.legs
				)[0];
	best.recommended = true;
	return options;
}

export interface ScheduleInput {
	teamIds: readonly number[];
	legs: number;
	/** Number of matches to play on each day. Must add up to the total for the format. */
	matchesPerDay: readonly number[];
	/** Pass a random number generator to draw the fixtures instead of using the fixed order. */
	rng?: Rng;
}

const NOT_PLAYED_TODAY = Number.MAX_SAFE_INTEGER;

/**
 * Places every pairing in a day and a slot.
 *
 * Rounds are played in order. Within a round, the next slot goes to the pairing whose teams have
 * played the least that day and have rested the longest, which keeps days balanced when a round
 * is split across two of them and avoids back-to-back matches whenever the round allows it.
 */
export function buildSchedule({
	teamIds,
	legs,
	matchesPerDay,
	rng
}: ScheduleInput): ScheduledMatch[] {
	const expected = totalMatches(teamIds.length, legs);
	const planned = matchesPerDay.reduce((sum, count) => sum + count, 0);
	if (matchesPerDay.some((count) => !Number.isInteger(count) || count < 0)) {
		throw new RangeError('Matches per day must be non-negative integers');
	}
	if (planned !== expected) {
		throw new RangeError(`Matches per day add up to ${planned}, expected ${expected}`);
	}

	const rounds = buildRounds(teamIds, legs, rng);
	const schedule: ScheduledMatch[] = [];
	let nextRound = 0;
	let pool: Pairing[] = [];

	matchesPerDay.forEach((matchCount, dayIndex) => {
		const gamesToday = new Map<number, number>();
		const lastSlot = new Map<number, number>();
		const games = (teamId: number) => gamesToday.get(teamId) ?? 0;

		for (let slot = 0; slot < matchCount; slot++) {
			if (pool.length === 0) pool = [...rounds[nextRound++]];

			const rest = (teamId: number) => {
				const last = lastSlot.get(teamId);
				return last === undefined ? NOT_PLAYED_TODAY : slot - last;
			};
			const rank = (pairing: Pairing) => ({
				busiest: Math.max(games(pairing.homeId), games(pairing.awayId)),
				load: games(pairing.homeId) + games(pairing.awayId),
				shortestRest: Math.min(rest(pairing.homeId), rest(pairing.awayId)),
				longestRest: Math.max(rest(pairing.homeId), rest(pairing.awayId))
			});

			let bestIndex = 0;
			let best = rank(pool[0]);
			for (let index = 1; index < pool.length; index++) {
				const candidate = rank(pool[index]);
				const difference =
					candidate.busiest - best.busiest ||
					candidate.load - best.load ||
					best.shortestRest - candidate.shortestRest ||
					best.longestRest - candidate.longestRest;
				if (difference < 0) {
					bestIndex = index;
					best = candidate;
				}
			}

			const [pairing] = pool.splice(bestIndex, 1);
			for (const teamId of [pairing.homeId, pairing.awayId]) {
				gamesToday.set(teamId, games(teamId) + 1);
				lastSlot.set(teamId, slot);
			}
			schedule.push({ ...pairing, dayIndex, slot });
		}
	});

	return schedule;
}

interface PlayedMatch {
	homeTeamId: number;
	awayTeamId: number;
}

/**
 * Whether the stored calendar still matches the current teams and format. It stops matching when
 * a team is added or removed after the calendar was generated.
 */
export function isScheduleOutdated(
	teamIds: readonly number[],
	legs: number,
	matches: readonly PlayedMatch[]
): boolean {
	if (matches.length === 0) return false;
	if (matches.length !== totalMatches(teamIds.length, legs)) return true;
	const withMatches = new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]));
	return teamIds.some((teamId) => !withMatches.has(teamId));
}

/** Counts how many matches each team plays on each day, in the order of `dayIds`. */
export function gamesPerTeamByDay(
	teamIds: readonly number[],
	dayIds: readonly number[],
	matches: readonly (PlayedMatch & { matchDayId: number })[]
): Map<number, number[]> {
	const dayIndex = new Map(dayIds.map((id, index) => [id, index]));
	const table = new Map(teamIds.map((id) => [id, dayIds.map(() => 0)]));
	for (const match of matches) {
		const index = dayIndex.get(match.matchDayId);
		if (index === undefined) continue;
		for (const teamId of [match.homeTeamId, match.awayTeamId]) {
			const row = table.get(teamId);
			if (row) row[index] += 1;
		}
	}
	return table;
}
