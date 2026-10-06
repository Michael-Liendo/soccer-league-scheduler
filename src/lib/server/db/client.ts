import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.ts';

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * The SQL files written by `drizzle-kit generate`, bundled into the server so the app can bring
 * its own database up to date on start without needing the `drizzle` folder at runtime.
 */
const migrationFiles = import.meta.glob<string>('/drizzle/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
});

const STATEMENT_SEPARATOR = '--> statement-breakpoint';

/** Applies the migrations that have not run yet, in file name order. Returns their names. */
export function runMigrations(sqlite: Database.Database): string[] {
	sqlite.exec(
		'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
	);
	const rows = sqlite.prepare('SELECT name FROM _migrations').all() as { name: string }[];
	const applied = new Set(rows.map((row) => row.name));
	const pending = Object.entries(migrationFiles)
		.map(([path, sql]) => ({ name: path.slice(path.lastIndexOf('/') + 1), sql }))
		.filter((migration) => !applied.has(migration.name))
		.sort((a, b) => a.name.localeCompare(b.name));
	if (pending.length === 0) return [];

	const record = sqlite.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
	// Rebuilding a table drops the old one, which would cascade into its children if foreign keys
	// were enforced. The pragma is ignored inside a transaction, so it is switched off around it.
	sqlite.pragma('foreign_keys = OFF');
	try {
		for (const migration of pending) {
			sqlite.transaction(() => {
				for (const statement of migration.sql.split(STATEMENT_SEPARATOR)) {
					if (statement.trim()) sqlite.exec(statement);
				}
				record.run(migration.name, Date.now());
			})();
		}
	} finally {
		sqlite.pragma('foreign_keys = ON');
	}
	return pending.map((migration) => migration.name);
}

/** Opens (creating it if needed) the SQLite database at `path` and migrates it. */
export function openDatabase(path: string): Db {
	const inMemory = path === ':memory:';
	if (!inMemory) mkdirSync(dirname(path), { recursive: true });

	const sqlite = new Database(path);
	if (!inMemory) sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	runMigrations(sqlite);

	return drizzle(sqlite, { schema });
}
