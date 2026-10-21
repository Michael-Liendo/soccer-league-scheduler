import { fail } from '@sveltejs/kit';
import { attempt, integer, text, texts } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import { createRateLimiter } from '#lib/server/rate-limit.ts';
import { requireAdmin, requireOwner } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

// Each sign-up counts against the visitor's address, so nobody can flood the list.
const signUps = createRateLimiter({ maxFailures: 10, windowMs: 10 * 60_000 });

export const load: PageServerLoad = () => ({ registrations: league().listRegistrations() });

export const actions: Actions = {
	register: async (event) => {
		let clientKey = 'unknown';
		try {
			clientKey = event.getClientAddress();
		} catch {
			// Without an address every visitor shares one counter.
		}
		if (signUps.isLocked(clientKey)) {
			return fail(429, { error: 'Demasiados registros seguidos. Espera unos minutos.' });
		}
		const form = await event.request.formData();
		return attempt(() => {
			const { added, skipped } = league().addRegistrations(texts(form, 'name'));
			signUps.recordFailure(clientKey);
			const parts = [];
			if (added.length > 0) parts.push(`Anotado: ${added.join(', ')}`);
			if (skipped.length > 0) parts.push(`Ya estaba en la lista: ${skipped.join(', ')}`);
			return { message: parts.join('. ') };
		});
	},

	/** Opens or closes the form; the list of names stays. */
	toggle: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			requireOwner(locals);
			const open = form.get('open') === 'true';
			league().setRegistrationOpen(open);
			return { message: open ? 'Convocatoria abierta' : 'Convocatoria cerrada' };
		});
	},

	rename: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().renameRegistration(integer(form, 'id'), text(form, 'name'));
			return { message: 'Nombre corregido' };
		});
	},

	remove: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			league().removeRegistration(integer(form, 'id'));
			return { message: 'Quitado de la lista' };
		});
	},

	clear: async ({ locals }) => {
		requireAdmin(locals);
		return attempt(() => {
			requireOwner(locals);
			league().clearRegistrations();
			return { message: 'Lista borrada' };
		});
	}
};
