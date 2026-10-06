import { DATABASE_URL } from '$app/env/private';
import { openDatabase, type Db } from './client.ts';

// The dev server re-evaluates this module on every change. Keeping the connection on
// `globalThis` stops it from opening the database file again each time.
const cache = globalThis as typeof globalThis & { __leagueDb?: { path: string; db: Db } };

export function getDatabase(): Db {
	if (cache.__leagueDb?.path !== DATABASE_URL) {
		cache.__leagueDb = { path: DATABASE_URL, db: openDatabase(DATABASE_URL) };
	}
	return cache.__leagueDb.db;
}
