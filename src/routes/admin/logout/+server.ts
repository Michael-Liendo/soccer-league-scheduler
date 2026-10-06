import { redirect } from '@sveltejs/kit';
import { logOut } from '#lib/server/session.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	logOut(cookies);
	redirect(303, '/');
};
