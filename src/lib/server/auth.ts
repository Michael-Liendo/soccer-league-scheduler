import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const LOGIN_PATH = '/admin/login';

/**
 * Whether a route may only be used with an admin session: everything under `/admin` except the
 * login page.
 *
 * It takes the id of the route the router matched, never the URL. The same route can be spelled
 * in many ways in a URL (`/%61dmin/equipos` reaches `/admin/equipos`), so a check on the raw
 * path can be walked around; the route id is what will actually run.
 */
export function requiresAdminSession(routeId: string | null): boolean {
	if (routeId === null) return false;
	const isAdminRoute = routeId === '/admin' || routeId.startsWith('/admin/');
	return isAdminRoute && routeId !== LOGIN_PATH;
}

function digest(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

/** Compares two secrets without leaking, through timing, how much of them matched. */
function safeEqual(a: string, b: string): boolean {
	return timingSafeEqual(digest(a), digest(b));
}

function sign(adminCode: string, payload: string): string {
	const key = digest(`soccer-league-scheduler:session:${adminCode}`);
	return createHmac('sha256', key).update(payload).digest('base64url');
}

export function isCorrectCode(adminCode: string, attempt: string): boolean {
	return attempt.length > 0 && safeEqual(adminCode, attempt.trim());
}

/**
 * `owner` signed in with the admin code and can do everything. `helper` signed in with a code the
 * owner created: enough to run matches and load teams, not to delete or rebuild things.
 */
export type SessionRole = 'owner' | 'helper';

export interface SessionClaims {
	role: SessionRole;
	/** The access code a helper signed in with. Null for the owner. */
	codeId: number | null;
}

const OWNER: SessionClaims = { role: 'owner', codeId: null };

/**
 * Creates a signed, self-contained session token. It is derived from the admin code, so changing
 * the code signs everybody out.
 */
export function createSessionToken(
	adminCode: string,
	claims: SessionClaims = OWNER,
	now: number = Date.now()
): string {
	const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
	const who = claims.role === 'owner' ? 'o' : `h${claims.codeId}`;
	const payload = `${expiresAt}.${who}`;
	return `${payload}.${sign(adminCode, payload)}`;
}

/** Who a session token belongs to, or null when it is missing, expired or not ours. */
export function readSessionToken(
	adminCode: string,
	token: string | undefined,
	now: number = Date.now()
): SessionClaims | null {
	const match = /^(\d+)\.(o|h\d+)\.([\w-]+)$/.exec(token ?? '');
	if (!match) return null;
	const [, expiresAt, who, signature] = match;
	if (Number(expiresAt) <= now) return null;
	if (!safeEqual(signature, sign(adminCode, `${expiresAt}.${who}`))) return null;
	return who === 'o' ? OWNER : { role: 'helper', codeId: Number(who.slice(1)) };
}

/** Letters and digits that are hard to mix up when read aloud or typed on a phone. */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** A new random access code such as `k7mp-2xqa-9dnh`. */
export function generateAccessCode(): string {
	const group = () =>
		Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
	return `${group()}-${group()}-${group()}`;
}

/** What is stored instead of an access code. Codes are random, so a plain hash is enough. */
export function hashAccessCode(code: string): string {
	return digest(`soccer-league-scheduler:access-code:${code.trim().toLowerCase()}`).toString('hex');
}
