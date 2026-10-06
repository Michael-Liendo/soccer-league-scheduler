import { describe, expect, it } from 'vitest';
import {
	addDays,
	addMinutes,
	formatDate,
	formatDateRange,
	formatDuration,
	formatTime,
	fromMinutes,
	isClockTime,
	isIsoDate,
	nextWeekdayDates,
	plural,
	todayIso,
	weekdayOf
} from './format.ts';

const SATURDAY = 6;

describe('dates', () => {
	it('accepts only real calendar dates', () => {
		expect(isIsoDate('2026-10-10')).toBe(true);
		expect(isIsoDate('2026-02-30')).toBe(false);
		expect(isIsoDate('10/10/2026')).toBe(false);
		expect(isIsoDate(null)).toBe(false);
	});

	it('knows the day of the week without depending on the time zone', () => {
		expect(weekdayOf('2026-10-10')).toBe(SATURDAY);
		expect(weekdayOf('2026-10-05')).toBe(1);
	});

	it('moves across month boundaries', () => {
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('finds the four Saturdays of the cup starting from a Monday', () => {
		expect(nextWeekdayDates('2026-10-05', SATURDAY, 4)).toEqual([
			'2026-10-10',
			'2026-10-17',
			'2026-10-24',
			'2026-10-31'
		]);
	});

	it('includes the starting date when it already falls on that weekday', () => {
		expect(nextWeekdayDates('2026-10-10', SATURDAY, 2)).toEqual(['2026-10-10', '2026-10-17']);
	});

	it('formats dates in Spanish', () => {
		expect(formatDate('2026-10-10', 'long')).toBe('sábado 10 de octubre');
		expect(formatDate('2026-10-10', 'medium')).toBe('sáb 10 oct');
		expect(formatDate('2026-10-10', 'short')).toBe('10 oct');
		expect(formatDate('not a date')).toBe('not a date');
	});

	it('describes a range of dates', () => {
		expect(formatDateRange('2026-10-10', '2026-10-31')).toBe('del 10 al 31 de octubre');
		expect(formatDateRange('2026-09-26', '2026-10-17')).toBe(
			'del 26 de septiembre al 17 de octubre'
		);
		expect(formatDateRange('2026-10-10', '2026-10-10')).toBe('10 de octubre');
	});

	it('reads today in the time zone of the league', () => {
		const lateEveningUtc = new Date('2026-10-11T02:30:00Z');
		expect(todayIso('America/Caracas', lateEveningUtc)).toBe('2026-10-10');
		expect(todayIso('UTC', lateEveningUtc)).toBe('2026-10-11');
	});
});

describe('times', () => {
	it('accepts only 24-hour clock times', () => {
		expect(isClockTime('09:00')).toBe(true);
		expect(isClockTime('23:59')).toBe(true);
		expect(isClockTime('24:00')).toBe(false);
		expect(isClockTime('9:00')).toBe(false);
	});

	it('adds minutes to a time', () => {
		expect(addMinutes('09:00', 25)).toBe('09:25');
		expect(addMinutes('11:50', 25)).toBe('12:15');
		expect(fromMinutes(24 * 60 + 5)).toBe('00:05');
	});

	it('formats times with a 12-hour clock', () => {
		expect(formatTime('09:05')).toBe('9:05 a. m.');
		expect(formatTime('13:30')).toBe('1:30 p. m.');
		expect(formatTime('00:00')).toBe('12:00 a. m.');
		expect(formatTime('12:00')).toBe('12:00 p. m.');
	});

	it('formats durations', () => {
		expect(formatDuration(220)).toBe('3 h 40 min');
		expect(formatDuration(120)).toBe('2 h');
		expect(formatDuration(45)).toBe('45 min');
	});
});

describe('plural', () => {
	it('picks the singular only for one', () => {
		expect(plural(1, 'partido')).toBe('1 partido');
		expect(plural(0, 'partido')).toBe('0 partidos');
		expect(plural(2, 'jugador', 'jugadores')).toBe('2 jugadores');
	});
});
