import { redirect } from '@sveltejs/kit';
import { generateAccessCode, hashAccessCode } from '#lib/server/auth.ts';
import { attempt, integer, text } from '#lib/server/forms.ts';
import { league } from '#lib/server/league.ts';
import { requireAdmin, requireOwner } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings and access codes are the owner's business; helpers go back to the teams.
export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	if (locals.session?.role !== 'owner') redirect(303, '/admin/equipos');
	return { accessCodes: league().listAccessCodes() };
};

export const actions: Actions = {
	saveSettings: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			requireOwner(locals);
			league().updateSettings({
				name: text(form, 'name'),
				location: text(form, 'location'),
				venue: text(form, 'venue'),
				playersOnField: integer(form, 'playersOnField')
			});
			return { message: 'Configuración guardada' };
		});
	},

	/** Creates a code for a helper. The code is shown once, here, and only its hash is kept. */
	createCode: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			requireOwner(locals);
			const label = text(form, 'label');
			const code = generateAccessCode();
			league().createAccessCode(label, hashAccessCode(code));
			return { message: 'Clave creada', newCode: { label: label.trim(), code } };
		});
	},

	revokeCode: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		return attempt(() => {
			requireOwner(locals);
			league().revokeAccessCode(integer(form, 'codeId'));
			return { message: 'Clave revocada: esa persona ya no puede entrar' };
		});
	},

	reset: async ({ locals }) => {
		requireAdmin(locals);
		return attempt(() => {
			requireOwner(locals);
			league().resetTournament();
			return { message: 'Torneo reiniciado' };
		});
	}
};
