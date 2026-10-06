import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { LOGIN_PATH, requiresAdminSession } from '#lib/server/auth.ts';
import { hasAdminSession } from '#lib/server/session.ts';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.isAdmin = hasAdminSession(event.cookies);

	// Guarding here covers pages, their data requests, form actions and endpoints in one place.
	// Admin actions and endpoints also check the session themselves, as a second barrier.
	if (requiresAdminSession(event.route.id) && !event.locals.isAdmin) {
		redirect(303, LOGIN_PATH);
	}

	return resolve(event);
};
