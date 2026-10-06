import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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
 * Creates a signed, self-contained session token. It is derived from the admin code, so changing
 * the code signs everybody out.
 */
export function createSessionToken(adminCode: string, now: number = Date.now()): string {
	const expiresAt = String(now + SESSION_MAX_AGE_SECONDS * 1000);
	return `${expiresAt}.${sign(adminCode, expiresAt)}`;
}

export function isValidSessionToken(
	adminCode: string,
	token: string | undefined,
	now: number = Date.now()
): boolean {
	if (!token) return false;
	const separator = token.indexOf('.');
	if (separator < 1) return false;
	const expiresAt = token.slice(0, separator);
	const signature = token.slice(separator + 1);
	if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= now) return false;
	return safeEqual(signature, sign(adminCode, expiresAt));
}
