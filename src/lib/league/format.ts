/**
 * Date and time helpers for the league.
 *
 * Dates travel as `YYYY-MM-DD` strings and times as `HH:MM` strings, both in the league's local
 * time, so nothing here depends on the time zone of the server or of the visitor. Formatting is
 * done by hand instead of with `Intl` so that server and browser always render the same text.
 */

export const LEAGUE_TIME_ZONE = 'America/Caracas';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = [
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre'
];
const MONTHS_SHORT = [
	'ene',
	'feb',
	'mar',
	'abr',
	'may',
	'jun',
	'jul',
	'ago',
	'sep',
	'oct',
	'nov',
	'dic'
];

const NBSP = ' ';
const MINUTES_PER_DAY = 24 * 60;

interface DateParts {
	year: number;
	month: number;
	day: number;
}

function parseIsoDate(iso: string): DateParts | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!match) return null;
	const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
	const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
	const isRealDate =
		date.getUTCFullYear() === parts.year &&
		date.getUTCMonth() === parts.month - 1 &&
		date.getUTCDate() === parts.day;
	return isRealDate ? parts : null;
}

function toIsoDate(date: Date): string {
	const year = String(date.getUTCFullYear()).padStart(4, '0');
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function isIsoDate(value: unknown): value is string {
	return typeof value === 'string' && parseIsoDate(value) !== null;
}

export function isClockTime(value: unknown): value is string {
	return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Day of the week for an ISO date: 0 is Sunday, 6 is Saturday. */
export function weekdayOf(iso: string): number {
	const parts = parseIsoDate(iso);
	if (!parts) return 0;
	return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function addDays(iso: string, days: number): string {
	const parts = parseIsoDate(iso);
	if (!parts) return iso;
	return toIsoDate(new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)));
}

/** The next `count` dates that fall on `weekday`, starting at `fromIso` itself if it matches. */
export function nextWeekdayDates(fromIso: string, weekday: number, count: number): string[] {
	const offset = (weekday - weekdayOf(fromIso) + 7) % 7;
	return Array.from({ length: count }, (_, index) => addDays(fromIso, offset + index * 7));
}

export type DateStyle = 'long' | 'medium' | 'short';

/**
 * - `long`: "sábado 10 de octubre"
 * - `medium`: "sáb 10 oct"
 * - `short`: "10 oct"
 */
export function formatDate(iso: string, style: DateStyle = 'medium'): string {
	const parts = parseIsoDate(iso);
	if (!parts) return iso;
	const weekday = weekdayOf(iso);
	if (style === 'long') return `${WEEKDAYS[weekday]} ${parts.day} de ${MONTHS[parts.month - 1]}`;
	if (style === 'short') return `${parts.day} ${MONTHS_SHORT[parts.month - 1]}`;
	return `${WEEKDAYS_SHORT[weekday]} ${parts.day} ${MONTHS_SHORT[parts.month - 1]}`;
}

/** "del 10 al 31 de octubre" or "del 26 de septiembre al 17 de octubre". */
export function formatDateRange(firstIso: string, lastIso: string): string {
	const first = parseIsoDate(firstIso);
	const last = parseIsoDate(lastIso);
	if (!first || !last) return '';
	if (firstIso === lastIso) return `${first.day} de ${MONTHS[first.month - 1]}`;
	const lastText = `${last.day} de ${MONTHS[last.month - 1]}`;
	if (first.year === last.year && first.month === last.month) {
		return `del ${first.day} al ${lastText}`;
	}
	return `del ${first.day} de ${MONTHS[first.month - 1]} al ${lastText}`;
}

export function toMinutes(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

export function fromMinutes(totalMinutes: number): string {
	const wrapped =
		((Math.round(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
	const minutes = String(wrapped % 60).padStart(2, '0');
	return `${hours}:${minutes}`;
}

export function addMinutes(time: string, minutes: number): string {
	return fromMinutes(toMinutes(time) + minutes);
}

/** "09:05" becomes "9:05 a. m." and "13:30" becomes "1:30 p. m.". */
export function formatTime(time: string): string {
	if (!isClockTime(time)) return time;
	const total = toMinutes(time);
	const hours24 = Math.floor(total / 60);
	const minutes = String(total % 60).padStart(2, '0');
	const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
	const period = hours24 < 12 ? 'a.' : 'p.';
	return `${hours12}:${minutes}${NBSP}${period}${NBSP}m.`;
}

/** 220 becomes "3 h 40 min"; 45 becomes "45 min"; 120 becomes "2 h". */
export function formatDuration(totalMinutes: number): string {
	const minutes = Math.max(0, Math.round(totalMinutes));
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return `${rest}${NBSP}min`;
	if (rest === 0) return `${hours}${NBSP}h`;
	return `${hours}${NBSP}h ${rest}${NBSP}min`;
}

/** Today's date in the given IANA time zone, as `YYYY-MM-DD`. */
export function todayIso(timeZone: string = LEAGUE_TIME_ZONE, now: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
	return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1 partido" / "3 partidos". */
export function plural(count: number, singular: string, pluralForm: string = `${singular}s`) {
	return `${count} ${count === 1 ? singular : pluralForm}`;
}
