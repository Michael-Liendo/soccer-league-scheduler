import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Single-row table (id is always 1) holding the tournament settings. */
export const tournament = sqliteTable('tournament', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	location: text('location').notNull(),
	venue: text('venue').notNull().default(''),
	playersOnField: integer('players_on_field').notNull().default(3),
	pointsWin: integer('points_win').notNull().default(3),
	pointsDraw: integer('points_draw').notNull().default(1),
	pointsLoss: integer('points_loss').notNull().default(0),
	legs: integer('legs').notNull().default(1),
	startTime: text('start_time').notNull().default('09:00'),
	endTime: text('end_time').notNull().default('13:00'),
	matchMinutes: integer('match_minutes').notNull().default(20),
	breakMinutes: integer('break_minutes').notNull().default(5),
	updatedAt: integer('updated_at').notNull()
});

export const matchDays = sqliteTable(
	'match_days',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Calendar date as `YYYY-MM-DD`, in the league's local time. */
		date: text('date').notNull()
	},
	(table) => [uniqueIndex('match_days_date_unique').on(table.date)]
);

export const teams = sqliteTable('teams', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	color: text('color').notNull(),
	createdAt: integer('created_at').notNull()
});

export const players = sqliteTable(
	'players',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		teamId: integer('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		number: text('number'),
		position: text('position'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [index('players_team_idx').on(table.teamId)]
);

export const matches = sqliteTable(
	'matches',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		matchDayId: integer('match_day_id')
			.notNull()
			.references(() => matchDays.id, { onDelete: 'cascade' }),
		/** Round-robin round this pairing belongs to (1-based, across all legs). */
		round: integer('round').notNull(),
		leg: integer('leg').notNull(),
		/** Order of the match within its day (0-based). */
		slot: integer('slot').notNull(),
		/** Kick-off as `HH:MM`, in the league's local time. */
		time: text('time'),
		/** Overrides the tournament venue when set. */
		venue: text('venue'),
		homeTeamId: integer('home_team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		awayTeamId: integer('away_team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('pending'),
		homeScore: integer('home_score').notNull().default(0),
		awayScore: integer('away_score').notNull().default(0),
		/** Epoch milliseconds since which the match clock is running, or null while it is stopped. */
		clockStartedAt: integer('clock_started_at'),
		/** Playing time, in milliseconds, accumulated before the clock was last started. */
		clockElapsedMs: integer('clock_elapsed_ms').notNull().default(0),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [index('matches_day_idx').on(table.matchDayId)]
);

export const matchEvents = sqliteTable(
	'match_events',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		matchId: integer('match_id')
			.notNull()
			.references(() => matches.id, { onDelete: 'cascade' }),
		teamId: integer('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		playerId: integer('player_id').references(() => players.id, { onDelete: 'set null' }),
		/** Snapshot of the player's name, kept if the player is later removed. */
		playerName: text('player_name').notNull(),
		type: text('type').notNull(),
		minute: integer('minute'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [index('match_events_match_idx').on(table.matchId)]
);
