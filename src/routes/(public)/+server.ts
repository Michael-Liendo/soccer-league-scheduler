import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The calendar is the home page until the standings exist.
export const GET: RequestHandler = () => {
	redirect(307, '/partidos');
};
