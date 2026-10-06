/**
 * The match clock. A match stores the time played before the clock was last started and, while
 * it runs, the moment it was started; everything else is derived from those two values and the
 * current time, so the clock keeps going without the server doing anything.
 */
import { LIMITS } from './types.ts';

export interface Clocked {
	clockStartedAt: number | null;
	clockElapsedMs: number;
}

export const MAX_CLOCK_MS = LIMITS.maxClockMinutes * 60_000;

export function isClockRunning(match: Clocked): boolean {
	return match.clockStartedAt !== null;
}

/** Whether the clock has ever run for this match. */
export function hasClockStarted(match: Clocked): boolean {
	return match.clockStartedAt !== null || match.clockElapsedMs > 0;
}

/** Milliseconds played so far, as of `now` (epoch milliseconds). */
export function elapsedMs(match: Clocked, now: number): number {
	const sinceStart = match.clockStartedAt === null ? 0 : Math.max(0, now - match.clockStartedAt);
	return Math.min(MAX_CLOCK_MS, Math.max(0, match.clockElapsedMs) + sinceStart);
}

/** The minute being played, counting from 1, or null if the clock never started. */
export function minuteOfPlay(match: Clocked, now: number): number | null {
	if (!hasClockStarted(match)) return null;
	return Math.floor(elapsedMs(match, now) / 60_000) + 1;
}

/** "07:05" for seven minutes and five seconds. Minutes keep growing past 59. */
export function formatClock(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
	const seconds = String(totalSeconds % 60).padStart(2, '0');
	return `${minutes}:${seconds}`;
}
