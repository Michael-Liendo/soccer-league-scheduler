import { fail, type ActionFailure } from '@sveltejs/kit';
import { LeagueError } from './errors.ts';

/** The value of a form field as text, or an empty string when it is missing or a file. */
export function text(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
}

export function texts(form: FormData, key: string): string[] {
	return form.getAll(key).map((value) => (typeof value === 'string' ? value : ''));
}

/** A whole number from a form field, or `NaN` when it is not one. */
export function integer(form: FormData, key: string): number {
	return toInteger(text(form, key));
}

export function toInteger(value: string): number {
	const trimmed = value.trim();
	return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/**
 * Runs a change to the league and turns a {@link LeagueError} into a failed form result, so the
 * page can show its message instead of an error screen.
 */
export function attempt<T>(change: () => T): T | ActionFailure<{ error: string }> {
	try {
		return change();
	} catch (error) {
		if (error instanceof LeagueError) return fail(400, { error: error.message });
		throw error;
	}
}
