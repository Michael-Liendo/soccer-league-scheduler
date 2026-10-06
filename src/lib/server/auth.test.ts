import { describe, expect, it } from 'vitest';
import {
	createSessionToken,
	isCorrectCode,
	generateAccessCode,
	hashAccessCode,
	readSessionToken,
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
	const lifetime = SESSION_MAX_AGE_SECONDS * 1000;

	it('belong to the owner unless said otherwise, until they expire', () => {
		const token = createSessionToken(CODE, undefined, NOW);
		expect(readSessionToken(CODE, token, NOW)).toEqual({ role: 'owner', codeId: null });
		expect(readSessionToken(CODE, token, NOW + lifetime - 1)).not.toBeNull();
		expect(readSessionToken(CODE, token, NOW + lifetime)).toBeNull();
	});

	it('remember which access code a helper used', () => {
		const token = createSessionToken(CODE, { role: 'helper', codeId: 42 }, NOW);
		expect(readSessionToken(CODE, token, NOW)).toEqual({ role: 'helper', codeId: 42 });
	});

	it('stop working when the admin code changes', () => {
		const token = createSessionToken(CODE, undefined, NOW);
		expect(readSessionToken('another-code', token, NOW)).toBeNull();
	});

	it('cannot be edited to last longer or to become the owner', () => {
		const helper = createSessionToken(CODE, { role: 'helper', codeId: 7 }, NOW);
		const [expiresAt, , signature] = helper.split('.');
		expect(readSessionToken(CODE, `${expiresAt}.o.${signature}`, NOW)).toBeNull();
		expect(readSessionToken(CODE, `${expiresAt}.h8.${signature}`, NOW)).toBeNull();
		expect(
			readSessionToken(CODE, `${Number(expiresAt) + lifetime}.h7.${signature}`, NOW)
		).toBeNull();
	});

	it('rejects missing or malformed tokens', () => {
		for (const token of [undefined, '', 'not-a-token', '.o.signature', 'abc.o.def', '123.x.abc']) {
			expect(readSessionToken(CODE, token, NOW)).toBeNull();
		}
	});
});

describe('access codes', () => {
	it('are random, easy to type and hashed the same however they are typed', () => {
		const code = generateAccessCode();
		expect(code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
		expect(generateAccessCode()).not.toBe(code);
		expect(hashAccessCode(`  ${code.toUpperCase()} `)).toBe(hashAccessCode(code));
		expect(hashAccessCode(code)).not.toContain(code);
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
