import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/session.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	requireAdmin(locals);
	redirect(303, '/admin/equipos');
};
