import { defineEnvVars } from '@sveltejs/kit/env';

export const MIN_ADMIN_CODE_LENGTH = 6;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Path of the SQLite database file. Defaults to `local.db`.',
		schema: (value) => value?.trim() || 'local.db'
	},
	ADMIN_CODE: {
		description:
			'Private code that unlocks the admin panel. The panel stays disabled while it is unset.',
		schema: (value) => {
			const code = value?.trim();
			if (!code) return undefined;
			if (code.length < MIN_ADMIN_CODE_LENGTH) {
				throw new Error(`ADMIN_CODE must be at least ${MIN_ADMIN_CODE_LENGTH} characters long`);
			}
			return code;
		}
	}
});
