import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { hasAdminSession } from '#lib/server/session.ts';

const LOGIN_PATH = '/admin/login';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.isAdmin = hasAdminSession(event.cookies);

	const { pathname } = event.url;
	const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
	// Guarding here covers pages, their data requests and their form actions in one place.
	if (isAdminArea && pathname !== LOGIN_PATH && !event.locals.isAdmin) {
		redirect(303, LOGIN_PATH);
	}

	return resolve(event);
};
