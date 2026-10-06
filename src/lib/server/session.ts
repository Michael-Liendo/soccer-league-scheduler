import { redirect, type Cookies } from '@sveltejs/kit';
import { ADMIN_CODE } from '$app/env/private';
import {
	createSessionToken,
	hashAccessCode,
	isCorrectCode,
	LOGIN_PATH,
	readSessionToken,
	SESSION_COOKIE,
	SESSION_MAX_AGE_SECONDS,
	type SessionClaims,
	type SessionRole
} from './auth.ts';
import { LeagueError } from './errors.ts';
import { league } from './league.ts';
import { createRateLimiter } from './rate-limit.ts';

const loginAttempts = createRateLimiter({ maxFailures: 8, windowMs: 10 * 60 * 1000 });

/** Who is using the panel in this request. */
export interface PanelSession {
	role: SessionRole;
	/** Name shown in the panel: the helper's name, or "Administrador". */
	label: string;
}

/** The admin panel only works once `ADMIN_CODE` is set on the server. */
export function isAdminPanelEnabled(): boolean {
	return ADMIN_CODE !== undefined;
}

/**
 * The session carried by the request, if it is still good. A helper's session is checked
 * against the database every time, so revoking their code locks them out immediately.
 */
export function readSession(cookies: Cookies): PanelSession | null {
	if (ADMIN_CODE === undefined) return null;
	const claims = readSessionToken(ADMIN_CODE, cookies.get(SESSION_COOKIE));
	if (!claims) return null;
	if (claims.role === 'owner') return { role: 'owner', label: 'Administrador' };
	const code = claims.codeId === null ? null : league().getAccessCode(claims.codeId);
	return code ? { role: 'helper', label: code.label } : null;
}

/**
 * Sends anyone without a panel session to the login page. The server hook already does this
 * for every admin route; calling it again where data is changed or exported means a mistake in
 * one place cannot open the panel on its own.
 */
export function requireAdmin(locals: App.Locals): void {
	if (!locals.session) redirect(303, LOGIN_PATH);
}

/** Refuses anything only the owner may do: deleting, rebuilding the calendar, settings, codes. */
export function requireOwner(locals: App.Locals): void {
	requireAdmin(locals);
	if (locals.session?.role !== 'owner') {
		throw new LeagueError('Solo el administrador puede hacer esto.');
	}
}

export type LoginResult = 'ok' | 'wrong-code' | 'locked' | 'disabled';

/**
 * Checks the code and, if it is the admin code or a helper's, starts a session by setting the
 * cookie. `clientKey` identifies who is trying, to slow down guessing.
 */
export function logIn(cookies: Cookies, url: URL, clientKey: string, attempt: string): LoginResult {
	if (ADMIN_CODE === undefined) return 'disabled';
	if (loginAttempts.isLocked(clientKey)) return 'locked';

	let claims: SessionClaims | null = null;
	if (isCorrectCode(ADMIN_CODE, attempt)) {
		claims = { role: 'owner', codeId: null };
	} else if (attempt.trim()) {
		const code = league().useAccessCode(hashAccessCode(attempt));
		if (code) claims = { role: 'helper', codeId: code.id };
	}
	if (!claims) {
		loginAttempts.recordFailure(clientKey);
		return 'wrong-code';
	}

	loginAttempts.reset(clientKey);
	cookies.set(SESSION_COOKIE, createSessionToken(ADMIN_CODE, claims), {
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
