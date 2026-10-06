import { describe, expect, it } from 'vitest';
import {
	createSessionToken,
	isCorrectCode,
	isValidSessionToken,
	requiresAdminSession,
	SESSION_MAX_AGE_SECONDS
} from './auth.ts';
import { createRateLimiter } from './rate-limit.ts';

const CODE = 'copa-naiguata-2026';
const NOW = 1_800_000_000_000;

describe('routes that need a session', () => {
	it('protects everything under /admin', () => {
		expect(requiresAdminSession('/admin')).toBe(true);
		expect(requiresAdminSession('/admin/(panel)/equipos')).toBe(true);
		expect(requiresAdminSession('/admin/(panel)/configuracion')).toBe(true);
		expect(requiresAdminSession('/admin/respaldo')).toBe(true);
		expect(requiresAdminSession('/admin/logout')).toBe(true);
	});

	it('leaves the login page and the public site open', () => {
		expect(requiresAdminSession('/admin/login')).toBe(false);
		expect(requiresAdminSession('/(public)')).toBe(false);
		expect(requiresAdminSession('/(public)/partidos')).toBe(false);
		expect(requiresAdminSession('/health')).toBe(false);
		expect(requiresAdminSession('/administracion')).toBe(false);
	});

	it('has nothing to protect when no route matched', () => {
		expect(requiresAdminSession(null)).toBe(false);
	});
});

describe('admin code', () => {
	it('accepts the exact code, ignoring surrounding spaces', () => {
		expect(isCorrectCode(CODE, CODE)).toBe(true);
		expect(isCorrectCode(CODE, `  ${CODE} `)).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isCorrectCode(CODE, '')).toBe(false);
		expect(isCorrectCode(CODE, 'copa-naiguata-2025')).toBe(false);
		expect(isCorrectCode(CODE, CODE.toUpperCase())).toBe(false);
	});
});

describe('session tokens', () => {
	it('are valid until they expire', () => {
		const token = createSessionToken(CODE, NOW);
		const lifetime = SESSION_MAX_AGE_SECONDS * 1000;
		expect(isValidSessionToken(CODE, token, NOW)).toBe(true);
		expect(isValidSessionToken(CODE, token, NOW + lifetime - 1)).toBe(true);
		expect(isValidSessionToken(CODE, token, NOW + lifetime)).toBe(false);
	});

	it('stop working when the admin code changes', () => {
		const token = createSessionToken(CODE, NOW);
		expect(isValidSessionToken('another-code', token, NOW)).toBe(false);
	});

	it('cannot be extended by editing the expiry', () => {
		const token = createSessionToken(CODE, NOW);
		const signature = token.slice(token.indexOf('.') + 1);
		const forged = `${NOW + 10 * SESSION_MAX_AGE_SECONDS * 1000}.${signature}`;
		expect(isValidSessionToken(CODE, forged, NOW)).toBe(false);
	});

	it('rejects missing or malformed tokens', () => {
		expect(isValidSessionToken(CODE, undefined, NOW)).toBe(false);
		expect(isValidSessionToken(CODE, '', NOW)).toBe(false);
		expect(isValidSessionToken(CODE, 'not-a-token', NOW)).toBe(false);
		expect(isValidSessionToken(CODE, '.signature', NOW)).toBe(false);
		expect(isValidSessionToken(CODE, 'abc.def', NOW)).toBe(false);
	});
});

describe('rate limiter', () => {
	const options = { maxFailures: 3, windowMs: 1_000 };

	it('locks a key after too many failures', () => {
		const limiter = createRateLimiter(options);
		limiter.recordFailure('1.2.3.4', NOW);
		limiter.recordFailure('1.2.3.4', NOW);
		expect(limiter.isLocked('1.2.3.4', NOW)).toBe(false);
		limiter.recordFailure('1.2.3.4', NOW);
		expect(limiter.isLocked('1.2.3.4', NOW)).toBe(true);
		expect(limiter.isLocked('5.6.7.8', NOW)).toBe(false);
	});

	it('unlocks once the window has passed', () => {
		const limiter = createRateLimiter(options);
		for (let attempt = 0; attempt < 3; attempt++) limiter.recordFailure('1.2.3.4', NOW);
		expect(limiter.isLocked('1.2.3.4', NOW + 999)).toBe(true);
		expect(limiter.isLocked('1.2.3.4', NOW + 1_000)).toBe(false);
	});

	it('forgets failures after a successful login', () => {
		const limiter = createRateLimiter(options);
		limiter.recordFailure('1.2.3.4', NOW);
		limiter.recordFailure('1.2.3.4', NOW);
		limiter.reset('1.2.3.4');
		limiter.recordFailure('1.2.3.4', NOW);
		expect(limiter.isLocked('1.2.3.4', NOW)).toBe(false);
	});
});
