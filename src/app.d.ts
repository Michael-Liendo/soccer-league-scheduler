// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Who is using the admin panel, or null for a visitor. */
			session: import('#lib/server/session.ts').PanelSession | null;
			/** Whether the request carries a valid panel session, of the owner or of a helper. */
			isAdmin: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
