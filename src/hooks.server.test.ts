import { isRedirect, type RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { handle } from './hooks.server.ts';

/** Runs the server hook for a request without a session cookie. */
async function visit(url: string, routeId: string | null) {
	const event = {
		url: new URL(url, 'https://copa.example'),
		route: { id: routeId },
		cookies: { get: () => undefined },
		locals: {}
	} as unknown as RequestEvent;
	const resolve = async () => new Response('rendered');

	try {
		const response = await handle({ event, resolve });
		return { outcome: 'rendered' as const, status: response.status, isAdmin: event.locals.isAdmin };
	} catch (thrown) {
		if (!isRedirect(thrown)) throw thrown;
		return { outcome: 'redirected' as const, status: thrown.status, location: thrown.location };
	}
}

describe('server hook', () => {
	it('lets visitors read the public site', async () => {
		expect(await visit('/partidos', '/(public)/partidos')).toEqual({
			outcome: 'rendered',
			status: 200,
			isAdmin: false
		});
	});

	it('sends visitors without a session from the admin panel to the login page', async () => {
		expect(await visit('/admin/equipos', '/admin/(panel)/equipos')).toEqual({
			outcome: 'redirected',
			status: 303,
			location: '/admin/login'
		});
	});

	it('is not fooled by an admin path written with encoded characters', async () => {
		for (const path of ['/%61dmin/equipos', '/a%64min/equipos', '/%61%64min/respaldo']) {
			const routeId = path.endsWith('respaldo') ? '/admin/respaldo' : '/admin/(panel)/equipos';
			expect(await visit(path, routeId)).toMatchObject({
				outcome: 'redirected',
				location: '/admin/login'
			});
		}
	});

	it('keeps the login page reachable', async () => {
		expect(await visit('/admin/login', '/admin/login')).toMatchObject({ outcome: 'rendered' });
	});
});
