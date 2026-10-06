import { getDatabase } from './db/index.ts';
import { createLeagueStore, type LeagueStore } from './league-store.ts';

let store: LeagueStore | undefined;

/** The league store bound to the app's database, opened on first use. */
export function league(): LeagueStore {
	store ??= createLeagueStore(getDatabase());
	return store;
}
