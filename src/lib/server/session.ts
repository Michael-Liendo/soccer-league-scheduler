import type { Cookies } from '@sveltejs/kit';
import { ADMIN_CODE } from '$app/env/private';
import {
	createSessionToken,
	isCorrectCode,
	isValidSessionToken,
	SESSION_COOKIE,
	SESSION_MAX_AGE_SECONDS
} from './auth.ts';
import { createRateLimiter } from './rate-limit.ts';

const loginAttempts = createRateLimiter({ maxFailures: 8, windowMs: 10 * 60 * 1000 });

/** The admin panel only works once `ADMIN_CODE` is set on the server. */
export function isAdminPanelEnabled(): boolean {
	return ADMIN_CODE !== undefined;
}

export function hasAdminSession(cookies: Cookies): boolean {
	if (ADMIN_CODE === undefined) return false;
	return isValidSessionToken(ADMIN_CODE, cookies.get(SESSION_COOKIE));
}

export type LoginResult = 'ok' | 'wrong-code' | 'locked' | 'disabled';

/**
 * Checks the code and, if it is right, starts a session by setting the cookie.
 * `clientKey` identifies who is trying, to slow down guessing.
 */
export function logIn(cookies: Cookies, url: URL, clientKey: string, attempt: string): LoginResult {
	if (ADMIN_CODE === undefined) return 'disabled';
	if (loginAttempts.isLocked(clientKey)) return 'locked';
	if (!isCorrectCode(ADMIN_CODE, attempt)) {
		loginAttempts.recordFailure(clientKey);
		return 'wrong-code';
	}
	loginAttempts.reset(clientKey);
	cookies.set(SESSION_COOKIE, createSessionToken(ADMIN_CODE), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// A `secure` cookie would be dropped on a plain HTTP deployment and the login would loop.
		secure: url.protocol === 'https:',
		maxAge: SESSION_MAX_AGE_SECONDS
	});
	return 'ok';
}

export function logOut(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
