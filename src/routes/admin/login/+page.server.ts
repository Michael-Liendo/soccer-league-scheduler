import { fail, redirect } from '@sveltejs/kit';
import { text } from '#lib/server/forms.ts';
import { isAdminPanelEnabled, logIn, type LoginResult } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

const MESSAGES: Record<Exclude<LoginResult, 'ok'>, string> = {
	'wrong-code': 'Código incorrecto.',
	locked: 'Demasiados intentos. Espera 10 minutos antes de volver a probar.',
	disabled: 'El panel está desactivado en este servidor.'
};

export const load: PageServerLoad = ({ locals }) => {
	if (locals.isAdmin) redirect(303, '/admin');
	return { enabled: isAdminPanelEnabled() };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();

		let clientKey = 'unknown';
		try {
			clientKey = event.getClientAddress();
		} catch {
			// Without a client address every visitor shares one counter, which is still safe.
		}

		const result = logIn(event.cookies, event.url, clientKey, text(form, 'code'));
		if (result === 'ok') redirect(303, '/admin');
		return fail(result === 'locked' ? 429 : 400, { error: MESSAGES[result] });
	}
};
