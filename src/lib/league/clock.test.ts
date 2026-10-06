import { describe, expect, it } from 'vitest';
import {
	elapsedMs,
	formatClock,
	hasClockStarted,
	isClockRunning,
	MAX_CLOCK_MS,
	minuteOfPlay
} from './clock.ts';

const KICK_OFF = 1_800_000_000_000;
const MINUTE = 60_000;

describe('match clock', () => {
	const notStarted = { clockStartedAt: null, clockElapsedMs: 0 };
	const running = { clockStartedAt: KICK_OFF, clockElapsedMs: 0 };
	const paused = { clockStartedAt: null, clockElapsedMs: 10 * MINUTE };
	const resumed = { clockStartedAt: KICK_OFF, clockElapsedMs: 10 * MINUTE };

	it('stands at zero before kick-off', () => {
		expect(hasClockStarted(notStarted)).toBe(false);
		expect(isClockRunning(notStarted)).toBe(false);
		expect(elapsedMs(notStarted, KICK_OFF + 5 * MINUTE)).toBe(0);
		expect(minuteOfPlay(notStarted, KICK_OFF)).toBeNull();
	});

	it('counts from the moment it was started', () => {
		expect(isClockRunning(running)).toBe(true);
		expect(elapsedMs(running, KICK_OFF + 90_000)).toBe(90_000);
	});

	it('keeps its time while paused', () => {
		expect(hasClockStarted(paused)).toBe(true);
		expect(isClockRunning(paused)).toBe(false);
		expect(elapsedMs(paused, KICK_OFF + 30 * MINUTE)).toBe(10 * MINUTE);
	});

	it('adds the new stretch to the time already played after resuming', () => {
		expect(elapsedMs(resumed, KICK_OFF + 2 * MINUTE)).toBe(12 * MINUTE);
	});

	it('ignores a start time that is still in the future', () => {
		expect(elapsedMs(running, KICK_OFF - 5_000)).toBe(0);
	});

	it('stops counting at the limit', () => {
		expect(elapsedMs(running, KICK_OFF + 100 * 60 * MINUTE)).toBe(MAX_CLOCK_MS);
	});

	it('numbers the minutes of play from one', () => {
		expect(minuteOfPlay(running, KICK_OFF)).toBe(1);
		expect(minuteOfPlay(running, KICK_OFF + 59_999)).toBe(1);
		expect(minuteOfPlay(running, KICK_OFF + MINUTE)).toBe(2);
		expect(minuteOfPlay(paused, KICK_OFF)).toBe(11);
	});

	it('shows minutes and seconds', () => {
		expect(formatClock(0)).toBe('00:00');
		expect(formatClock(7 * MINUTE + 5_000)).toBe('07:05');
		expect(formatClock(75 * MINUTE + 59_999)).toBe('75:59');
		expect(formatClock(-1)).toBe('00:00');
	});
});
