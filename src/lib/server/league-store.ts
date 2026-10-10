import { asc, count, eq, max } from 'drizzle-orm';
import {
	formatDate,
	isClockTime,
	isIsoDate,
	nextWeekdayDates,
	todayIso,
	toMinutes
} from '#lib/league/format.ts';
import { elapsedMs, MAX_CLOCK_MS, minuteOfPlay } from '#lib/league/clock.ts';
import { nextTeamColor } from '#lib/league/labels.ts';
import { buildSchedule, slotTime, totalMatches, type PlanTiming } from '#lib/league/schedule.ts';
import {
	CARD_TYPES,
	FORFEIT_GOALS,
	goalValue,
	isCard,
	LIMITS,
	MATCH_EVENT_TYPES,
	MATCH_STATUSES,
	POSITIONS,
	SIDES,
	type League,
	type Match,
	type MatchEvent,
	type MatchEventType,
	type MatchStatus,
	type Player,
	type Position,
	type Side,
	type Team,
	type Tournament
} from '#lib/league/types.ts';
import type { Db } from './db/client.ts';
import {
	accessCodes,
	matchDays,
	matchEvents,
	matches,
	players,
	teams,
	tournament
} from './db/schema.ts';
import { LeagueError } from './errors.ts';

const TOURNAMENT_ID = 1;
const SATURDAY = 6;
const DEFAULT_MATCH_DAY_COUNT = 4;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const DEFAULT_TOURNAMENT = {
	name: 'Copa Naiguatá',
	location: 'Naiguatá',
	venue: '',
	playersOnField: 3,
	pointsWin: 3,
	pointsDraw: 1,
	pointsLoss: 0,
	legs: 1,
	startTime: '09:00',
	endTime: '13:00',
	matchMinutes: 20,
	breakMinutes: 5
};

export interface TeamInput {
	name: string;
	color: string;
}

export interface PlayerInput {
	name: string;
	number: string | null;
	position: Position | null;
}

export interface SettingsInput {
	name: string;
	location: string;
	venue: string;
	playersOnField: number;
	/** The cards the league uses. Left out, the ones it already has stay. */
	cards?: readonly string[];
	/** Whether goals worth two can be recorded. Left out, it stays as it is. */
	doubleGoals?: boolean;
}

export interface PlanDayInput {
	/** `null` for a day that does not exist yet. */
	id: number | null;
	date: string;
}

export interface PlanInput {
	days: PlanDayInput[];
	timing: PlanTiming;
}

export interface GenerateInput {
	/** Match days and timetable to save before generating. Omit to keep the current ones. */
	plan?: PlanInput;
	legs: number;
	/** Matches to play on each day, in date order (after applying `plan`). */
	matchesPerDay: number[];
	/** Draw the fixtures at random instead of using the fixed order. */
	random: boolean;
}

export interface MatchScheduleInput {
	matchDayId: number;
	time: string | null;
	venue: string | null;
}

export interface MatchEventInput {
	teamId: number;
	/** Null when nobody is named: an own goal, or a goal whose scorer is unknown. */
	playerId: number | null;
	type: MatchEventType;
	/** Minute of play. Left out, it is taken from the match clock. */
	minute?: number | null;
}

export interface TeamWithPlayersInput {
	name: string;
	players: PlayerInput[];
}

export type MoveDirection = 'earlier' | 'later';

const MAX_SCORE = 99;

/** A code the owner handed to a helper. The code itself is never stored, only its hash. */
export interface AccessCode {
	id: number;
	/** Who it was given to. */
	label: string;
	createdAt: number;
	lastUsedAt: number | null;
}

const MAX_ACCESS_CODES = 20;

export interface Clock {
	/** Current time in epoch milliseconds. */
	now: () => number;
	/** Today's date in the league's time zone, as `YYYY-MM-DD`. */
	today: () => string;
}

const systemClock: Clock = { now: () => Date.now(), today: () => todayIso() };

function cleanText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function requireText(value: string, label: string, maxLength: number): string {
	const text = cleanText(value);
	if (!text) throw new LeagueError(`Escribe ${label}.`);
	if (text.length > maxLength) {
		throw new LeagueError(`${label} no puede pasar de ${maxLength} caracteres.`);
	}
	return text;
}

function requireIntegerInRange(value: number, label: string, min: number, max: number): number {
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new LeagueError(`${label} debe estar entre ${min} y ${max}.`);
	}
	return value;
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
	return typeof value === 'string' && (options as readonly string[]).includes(value);
}

function validateTeam(input: TeamInput): TeamInput {
	const name = requireText(input.name, 'el nombre del equipo', LIMITS.teamName);
	if (!HEX_COLOR.test(input.color)) throw new LeagueError('Elige un color válido para el equipo.');
	return { name, color: input.color.toLowerCase() };
}

function validatePlayer(input: PlayerInput): PlayerInput {
	const name = requireText(input.name, 'el nombre del jugador', LIMITS.playerName);
	const number = input.number?.replace(/\D/g, '').slice(0, 3) || null;
	const position = isOneOf(POSITIONS, input.position) ? input.position : null;
	return { name, number, position };
}

function validateTiming(timing: PlanTiming): PlanTiming {
	if (!isClockTime(timing.startTime) || !isClockTime(timing.endTime)) {
		throw new LeagueError('Indica la hora de inicio y la hora límite.');
	}
	if (toMinutes(timing.endTime) <= toMinutes(timing.startTime)) {
		throw new LeagueError('La hora límite debe ser posterior a la hora de inicio.');
	}
	return {
		startTime: timing.startTime,
		endTime: timing.endTime,
		matchMinutes: requireIntegerInRange(
			timing.matchMinutes,
			'La duración del partido',
			LIMITS.minMatchMinutes,
			LIMITS.maxMatchMinutes
		),
		breakMinutes: requireIntegerInRange(
			timing.breakMinutes,
			'El descanso entre partidos',
			0,
			LIMITS.maxBreakMinutes
		)
	};
}

function validateDays(days: PlanDayInput[]): PlanDayInput[] {
	if (days.length === 0) throw new LeagueError('Agrega al menos un día de juego.');
	if (days.length > LIMITS.maxMatchDays) {
		throw new LeagueError(`No puede haber más de ${LIMITS.maxMatchDays} días de juego.`);
	}
	if (days.some((day) => !isIsoDate(day.date))) {
		throw new LeagueError('Revisa las fechas: hay un día sin fecha válida.');
	}
	if (new Set(days.map((day) => day.date)).size !== days.length) {
		throw new LeagueError('Hay dos días de juego con la misma fecha.');
	}
	return days;
}

function validatePlan(plan: PlanInput): PlanInput {
	return { days: validateDays(plan.days), timing: validateTiming(plan.timing) };
}

/**
 * Everything the app reads from and writes to the database. Rules that must always hold, such as
 * unique team names, are enforced here and reported as {@link LeagueError}s.
 */
export function createLeagueStore(db: Db, clock: Clock = systemClock) {
	type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
	type Executor = Db | Tx;

	function touch(executor: Executor): void {
		executor
			.update(tournament)
			.set({ updatedAt: clock.now() })
			.where(eq(tournament.id, TOURNAMENT_ID))
			.run();
	}

	function seedDefaults(executor: Executor): void {
		const existing = executor
			.select({ id: tournament.id })
			.from(tournament)
			.where(eq(tournament.id, TOURNAMENT_ID))
			.get();
		if (!existing) {
			executor
				.insert(tournament)
				.values({ id: TOURNAMENT_ID, ...DEFAULT_TOURNAMENT, updatedAt: clock.now() })
				.run();
		}
		const days = executor.select({ value: count() }).from(matchDays).get();
		if (!days?.value) {
			const dates = nextWeekdayDates(clock.today(), SATURDAY, DEFAULT_MATCH_DAY_COUNT);
			executor
				.insert(matchDays)
				.values(dates.map((date) => ({ date })))
				.run();
		}
	}

	function readTournament(executor: Executor): Tournament {
		const row = executor.select().from(tournament).where(eq(tournament.id, TOURNAMENT_ID)).get();
		if (!row) throw new Error('The tournament row is missing');
		return {
			name: row.name,
			location: row.location,
			venue: row.venue,
			playersOnField: row.playersOnField,
			cards: CARD_TYPES.filter((card) => row.cards.split(',').includes(card)),
			doubleGoals: row.doubleGoals,
			pointsWin: row.pointsWin,
			pointsDraw: row.pointsDraw,
			pointsLoss: row.pointsLoss,
			legs: row.legs,
			startTime: row.startTime,
			endTime: row.endTime,
			matchMinutes: row.matchMinutes,
			breakMinutes: row.breakMinutes,
			updatedAt: row.updatedAt
		};
	}

	function readTiming(executor: Executor): PlanTiming {
		const { startTime, endTime, matchMinutes, breakMinutes } = readTournament(executor);
		return { startTime, endTime, matchMinutes, breakMinutes };
	}

	function assertUniqueTeamName(executor: Executor, name: string, exceptId?: number): void {
		const wanted = name.toLocaleLowerCase('es');
		const taken = executor
			.select({ id: teams.id, name: teams.name })
			.from(teams)
			.all()
			.some((team) => team.id !== exceptId && team.name.toLocaleLowerCase('es') === wanted);
		if (taken) throw new LeagueError(`Ya existe un equipo llamado “${name}”.`);
	}

	function requireTeam(executor: Executor, id: number) {
		const team = executor.select().from(teams).where(eq(teams.id, id)).get();
		if (!team) throw new LeagueError('Ese equipo ya no existe.');
		return team;
	}

	function requireMatch(executor: Executor, id: number) {
		const match = executor.select().from(matches).where(eq(matches.id, id)).get();
		if (!match) throw new LeagueError('Ese partido ya no existe.');
		return match;
	}

	/** A match awarded without playing has no clock to run and no goals or cards to record. */
	function requirePlayableMatch(executor: Executor, id: number) {
		const match = requireMatch(executor, id);
		if (match.forfeitedBy !== null) {
			throw new LeagueError('Este partido se dio por W.O. Borra el resultado para poder jugarlo.');
		}
		return match;
	}

	/** The clock columns for a match whose clock stops now, keeping the time played so far. */
	function stoppedClock(match: { clockStartedAt: number | null; clockElapsedMs: number }) {
		return { clockStartedAt: null, clockElapsedMs: elapsedMs(match, clock.now()) };
	}

	function validateMinute(minute: number | null): number | null {
		if (minute === null) return null;
		return requireIntegerInRange(minute, 'El minuto', 1, LIMITS.maxClockMinutes);
	}

	/** Renumbers the matches of a day by kick-off time and gives each slot its time. */
	function retimeDay(executor: Executor, matchDayId: number, timing: PlanTiming): void {
		const dayMatches = executor
			.select({ id: matches.id, time: matches.time, slot: matches.slot })
			.from(matches)
			.where(eq(matches.matchDayId, matchDayId))
			.all()
			.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.slot - b.slot);
		dayMatches.forEach((match, slot) => {
			executor
				.update(matches)
				.set({ slot, time: slotTime(slot, timing) })
				.where(eq(matches.id, match.id))
				.run();
		});
	}

	/** Writes the match days and timetable of a validated plan. */
	function applyPlan(executor: Executor, plan: PlanInput): { retimed: boolean } {
		const { days, timing } = plan;
		const existing = executor.select().from(matchDays).all();
		const existingIds = new Set(existing.map((day) => day.id));
		const kept = days.filter((day) => day.id !== null);
		if (kept.some((day) => !existingIds.has(day.id as number))) {
			throw new LeagueError('Uno de los días ya no existe. Recarga la página.');
		}
		const keptIds = new Set(kept.map((day) => day.id));

		for (const day of existing) {
			if (keptIds.has(day.id)) continue;
			const scheduled = executor
				.select({ value: count() })
				.from(matches)
				.where(eq(matches.matchDayId, day.id))
				.get();
			if (scheduled?.value) {
				throw new LeagueError(
					`El ${formatDate(day.date, 'long')} tiene partidos programados. Muévelos a otro día o genera de nuevo el calendario antes de quitarlo.`
				);
			}
			executor.delete(matchDays).where(eq(matchDays.id, day.id)).run();
		}

		// Dates are unique, so park the kept days on placeholder values first. Otherwise two days
		// swapping dates would collide half-way through.
		for (const day of kept) {
			executor
				.update(matchDays)
				.set({ date: `moving-${day.id}` })
				.where(eq(matchDays.id, day.id as number))
				.run();
		}
		for (const day of kept) {
			executor
				.update(matchDays)
				.set({ date: day.date })
				.where(eq(matchDays.id, day.id as number))
				.run();
		}
		const added = days.filter((day) => day.id === null);
		if (added.length > 0) {
			executor
				.insert(matchDays)
				.values(added.map((day) => ({ date: day.date })))
				.run();
		}

		const previous = readTiming(executor);
		const kickoffsChanged =
			previous.startTime !== timing.startTime ||
			previous.matchMinutes !== timing.matchMinutes ||
			previous.breakMinutes !== timing.breakMinutes;
		executor.update(tournament).set(timing).where(eq(tournament.id, TOURNAMENT_ID)).run();

		if (!kickoffsChanged) return { retimed: false };
		const hasMatches = executor.select({ value: count() }).from(matches).get();
		if (!hasMatches?.value) return { retimed: false };
		for (const day of executor.select({ id: matchDays.id }).from(matchDays).all()) {
			retimeDay(executor, day.id, timing);
		}
		return { retimed: true };
	}

	db.transaction((tx) => seedDefaults(tx));

	return {
		/** When the league last changed, for clients that poll for updates. */
		getUpdatedAt(): number {
			return readTournament(db).updatedAt;
		},

		getLeague(): League {
			const days = db
				.select()
				.from(matchDays)
				.orderBy(asc(matchDays.date))
				.all()
				.map((day, index) => ({ id: day.id, date: day.date, number: index + 1 }));
			const dayNumber = new Map(days.map((day) => [day.id, day.number]));

			const playersByTeam = new Map<number, Player[]>();
			for (const row of db.select().from(players).orderBy(asc(players.id)).all()) {
				const player: Player = {
					id: row.id,
					teamId: row.teamId,
					name: row.name,
					number: row.number,
					position: isOneOf(POSITIONS, row.position) ? row.position : null
				};
				playersByTeam.set(row.teamId, [...(playersByTeam.get(row.teamId) ?? []), player]);
			}
			const leagueTeams: Team[] = db
				.select()
				.from(teams)
				.orderBy(asc(teams.id))
				.all()
				.map((row) => ({
					id: row.id,
					name: row.name,
					color: row.color,
					players: playersByTeam.get(row.id) ?? []
				}));

			const eventsByMatch = new Map<number, MatchEvent[]>();
			for (const row of db.select().from(matchEvents).orderBy(asc(matchEvents.id)).all()) {
				const event: MatchEvent = {
					id: row.id,
					matchId: row.matchId,
					teamId: row.teamId,
					playerId: row.playerId,
					playerName: row.playerName,
					type: (isOneOf(MATCH_EVENT_TYPES, row.type) ? row.type : 'goal') as MatchEventType,
					minute: row.minute
				};
				eventsByMatch.set(row.matchId, [...(eventsByMatch.get(row.matchId) ?? []), event]);
			}
			const leagueMatches: Match[] = db
				.select()
				.from(matches)
				.all()
				.map((row) => ({
					id: row.id,
					matchDayId: row.matchDayId,
					round: row.round,
					leg: row.leg,
					slot: row.slot,
					time: row.time,
					venue: row.venue,
					homeTeamId: row.homeTeamId,
					awayTeamId: row.awayTeamId,
					status: (isOneOf(MATCH_STATUSES, row.status) ? row.status : 'pending') as MatchStatus,
					homeScore: row.homeScore,
					awayScore: row.awayScore,
					clockStartedAt: row.clockStartedAt,
					clockElapsedMs: row.clockElapsedMs,
					forfeitedBy: isOneOf(SIDES, row.forfeitedBy) ? row.forfeitedBy : null,
					events: eventsByMatch.get(row.id) ?? []
				}))
				.sort(
					(a, b) =>
						(dayNumber.get(a.matchDayId) ?? 0) - (dayNumber.get(b.matchDayId) ?? 0) ||
						(a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
						a.slot - b.slot ||
						a.id - b.id
				);

			return {
				tournament: readTournament(db),
				matchDays: days,
				teams: leagueTeams,
				matches: leagueMatches
			};
		},

		updateSettings(input: SettingsInput): void {
			const values = {
				name: requireText(input.name, 'el nombre de la liga', LIMITS.leagueName),
				location: requireText(input.location, 'el lugar', LIMITS.location),
				venue: cleanText(input.venue).slice(0, LIMITS.venue),
				playersOnField: requireIntegerInRange(
					input.playersOnField,
					'Los jugadores en cancha',
					LIMITS.minPlayersOnField,
					LIMITS.maxPlayersOnField
				),
				// Stored in order of severity whatever order they arrive in; anything unknown is dropped.
				...(input.cards === undefined
					? {}
					: { cards: CARD_TYPES.filter((card) => input.cards?.includes(card)).join(',') }),
				...(input.doubleGoals === undefined ? {} : { doubleGoals: input.doubleGoals })
			};
			db.update(tournament)
				.set({ ...values, updatedAt: clock.now() })
				.where(eq(tournament.id, TOURNAMENT_ID))
				.run();
		},

		createTeam(input: TeamInput): number {
			const values = validateTeam(input);
			return db.transaction((tx) => {
				const total = tx.select({ value: count() }).from(teams).get();
				if ((total?.value ?? 0) >= LIMITS.maxTeams) {
					throw new LeagueError(`La liga admite hasta ${LIMITS.maxTeams} equipos.`);
				}
				assertUniqueTeamName(tx, values.name);
				const created = tx
					.insert(teams)
					.values({ ...values, createdAt: clock.now() })
					.returning({ id: teams.id })
					.get();
				touch(tx);
				return created.id;
			});
		},

		/**
		 * Creates several teams at once, each with its players, giving every team the next free
		 * colour. Names that are already taken are skipped and reported back.
		 */
		createTeams(inputs: TeamWithPlayersInput[]): { created: string[]; skipped: string[] } {
			return db.transaction((tx) => {
				const existing = tx.select({ name: teams.name, color: teams.color }).from(teams).all();
				const taken = new Set(existing.map((team) => team.name.toLocaleLowerCase('es')));
				const colors = existing.map((team) => team.color);
				const created: string[] = [];
				const skipped: string[] = [];

				for (const input of inputs) {
					const name = requireText(input.name, 'el nombre del equipo', LIMITS.teamName);
					const key = name.toLocaleLowerCase('es');
					if (taken.has(key)) {
						skipped.push(name);
						continue;
					}
					if (taken.size >= LIMITS.maxTeams) {
						throw new LeagueError(`La liga admite hasta ${LIMITS.maxTeams} equipos.`);
					}
					const color = nextTeamColor(colors);
					const now = clock.now();
					const team = tx
						.insert(teams)
						.values({ name, color, createdAt: now })
						.returning({ id: teams.id })
						.get();
					const roster = input.players.map(validatePlayer);
					if (roster.length > 0) {
						tx.insert(players)
							.values(roster.map((player) => ({ ...player, teamId: team.id, createdAt: now })))
							.run();
					}
					taken.add(key);
					colors.push(color);
					created.push(name);
				}
				if (created.length > 0) touch(tx);
				return { created, skipped };
			});
		},

		updateTeam(id: number, input: TeamInput): void {
			const values = validateTeam(input);
			db.transaction((tx) => {
				requireTeam(tx, id);
				assertUniqueTeamName(tx, values.name, id);
				tx.update(teams).set(values).where(eq(teams.id, id)).run();
				touch(tx);
			});
		},

		/** Removes a team together with its players and every match it was part of. */
		deleteTeam(id: number): void {
			db.transaction((tx) => {
				requireTeam(tx, id);
				tx.delete(teams).where(eq(teams.id, id)).run();
				touch(tx);
			});
		},

		addPlayer(teamId: number, input: PlayerInput): number {
			const values = validatePlayer(input);
			return db.transaction((tx) => {
				requireTeam(tx, teamId);
				const created = tx
					.insert(players)
					.values({ ...values, teamId, createdAt: clock.now() })
					.returning({ id: players.id })
					.get();
				touch(tx);
				return created.id;
			});
		},

		/** Adds several players to a team in one go. Returns how many were added. */
		addPlayers(teamId: number, inputs: PlayerInput[]): number {
			const roster = inputs.map(validatePlayer);
			if (roster.length === 0) throw new LeagueError('Escribe al menos un jugador.');
			return db.transaction((tx) => {
				requireTeam(tx, teamId);
				const now = clock.now();
				tx.insert(players)
					.values(roster.map((player) => ({ ...player, teamId, createdAt: now })))
					.run();
				touch(tx);
				return roster.length;
			});
		},

		updatePlayer(id: number, input: PlayerInput): void {
			const values = validatePlayer(input);
			db.transaction((tx) => {
				const updated = tx
					.update(players)
					.set(values)
					.where(eq(players.id, id))
					.returning({ id: players.id })
					.get();
				if (!updated) throw new LeagueError('Ese jugador ya no existe.');
				touch(tx);
			});
		},

		/**
		 * Moves a player to another team, keeping the goals and cards already to their name.
		 * Returns the name of the team they join.
		 */
		movePlayer(id: number, teamId: number): string {
			return db.transaction((tx) => {
				const team = requireTeam(tx, teamId);
				const moved = tx
					.update(players)
					.set({ teamId })
					.where(eq(players.id, id))
					.returning({ id: players.id })
					.get();
				if (!moved) throw new LeagueError('Ese jugador ya no existe.');
				touch(tx);
				return team.name;
			});
		},

		deletePlayer(id: number): void {
			db.transaction((tx) => {
				tx.delete(players).where(eq(players.id, id)).run();
				touch(tx);
			});
		},

		/**
		 * Saves the match days and the daily timetable. Existing matches keep their day; when the
		 * timetable changes, their kick-off times are recalculated. Returns whether that happened.
		 */
		savePlan(input: PlanInput): { retimed: boolean } {
			const plan = validatePlan(input);
			return db.transaction((tx) => {
				const result = applyPlan(tx, plan);
				touch(tx);
				return result;
			});
		},

		/**
		 * Replaces the whole calendar, discarding any results already entered. When a plan comes
		 * along it is saved first, as part of the same change.
		 */
		generateSchedule(input: GenerateInput): { matchCount: number } {
			const legs = requireIntegerInRange(input.legs, 'El número de vueltas', 1, LIMITS.maxLegs);
			const plan = input.plan ? validatePlan(input.plan) : undefined;

			return db.transaction((tx) => {
				const teamIds = tx
					.select({ id: teams.id })
					.from(teams)
					.orderBy(asc(teams.id))
					.all()
					.map((team) => team.id);
				if (teamIds.length < 2) {
					throw new LeagueError('Se necesitan al menos 2 equipos para armar el calendario.');
				}

				// The old matches go first so that the plan is free to drop the days they were on.
				tx.delete(matches).run();
				if (plan) applyPlan(tx, plan);

				const days = tx.select().from(matchDays).orderBy(asc(matchDays.date)).all();
				if (input.matchesPerDay.length !== days.length) {
					throw new LeagueError('Los días de juego cambiaron. Recarga la página.');
				}
				const expected = totalMatches(teamIds.length, legs);
				const planned = input.matchesPerDay.reduce((sum, value) => sum + value, 0);
				const validCounts = input.matchesPerDay.every(
					(value) => Number.isInteger(value) && value >= 0
				);
				if (!validCounts || planned !== expected) {
					throw new LeagueError(
						`Los partidos por día suman ${validCounts ? planned : 'un número inválido'}, pero el formato tiene ${expected}. Ajusta los números para que coincidan.`
					);
				}

				const timing = readTiming(tx);
				const schedule = buildSchedule({
					teamIds,
					legs,
					matchesPerDay: input.matchesPerDay,
					rng: input.random ? Math.random : undefined
				});
				const now = clock.now();
				if (schedule.length > 0) {
					tx.insert(matches)
						.values(
							schedule.map((match) => ({
								matchDayId: days[match.dayIndex].id,
								round: match.round,
								leg: match.leg,
								slot: match.slot,
								time: slotTime(match.slot, timing),
								homeTeamId: match.homeId,
								awayTeamId: match.awayId,
								updatedAt: now
							}))
						)
						.run();
				}
				tx.update(tournament).set({ legs }).where(eq(tournament.id, TOURNAMENT_ID)).run();
				touch(tx);
				return { matchCount: schedule.length };
			});
		},

		/** Moves a match to another day or time, or changes where it is played. */
		updateMatchSchedule(id: number, input: MatchScheduleInput): void {
			if (input.time !== null && !isClockTime(input.time)) {
				throw new LeagueError('La hora del partido no es válida.');
			}
			const venue = input.venue ? cleanText(input.venue).slice(0, LIMITS.venue) || null : null;

			db.transaction((tx) => {
				const match = requireMatch(tx, id);
				const day = tx
					.select({ id: matchDays.id })
					.from(matchDays)
					.where(eq(matchDays.id, input.matchDayId))
					.get();
				if (!day) throw new LeagueError('Ese día de juego ya no existe.');

				let slot = match.slot;
				if (match.matchDayId !== input.matchDayId) {
					const last = tx
						.select({ value: max(matches.slot) })
						.from(matches)
						.where(eq(matches.matchDayId, input.matchDayId))
						.get();
					slot = (last?.value ?? -1) + 1;
				}
				tx.update(matches)
					.set({
						matchDayId: input.matchDayId,
						slot,
						time: input.time,
						venue,
						updatedAt: clock.now()
					})
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		setMatchStatus(id: number, status: MatchStatus): void {
			if (!isOneOf(MATCH_STATUSES, status)) throw new LeagueError('Ese estado no es válido.');
			db.transaction((tx) => {
				const match = requirePlayableMatch(tx, id);
				tx.update(matches)
					.set({
						status,
						// Only a match being played has a running clock.
						...(status === 'live' ? {} : stoppedClock(match)),
						updatedAt: clock.now()
					})
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		/** Kicks off or resumes a match: it becomes live and its clock runs. */
		startMatch(id: number): void {
			db.transaction((tx) => {
				const match = requirePlayableMatch(tx, id);
				const now = clock.now();
				tx.update(matches)
					.set({ status: 'live', clockStartedAt: match.clockStartedAt ?? now, updatedAt: now })
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		/** Stops the clock, for half-time or a break, without ending the match. */
		pauseMatch(id: number): void {
			db.transaction((tx) => {
				const match = requirePlayableMatch(tx, id);
				tx.update(matches)
					.set({ ...stoppedClock(match), updatedAt: clock.now() })
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		/** Final whistle: the clock stops and the result counts for the table. */
		finishMatch(id: number): void {
			db.transaction((tx) => {
				const match = requirePlayableMatch(tx, id);
				tx.update(matches)
					.set({ status: 'finished', ...stoppedClock(match), updatedAt: clock.now() })
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		/** Sets the time played, to correct a clock that was started late or left running. */
		setClock(id: number, playedMs: number): void {
			if (!Number.isFinite(playedMs)) throw new LeagueError('Ese tiempo no es válido.');
			db.transaction((tx) => {
				const match = requirePlayableMatch(tx, id);
				const now = clock.now();
				tx.update(matches)
					.set({
						clockElapsedMs: Math.min(MAX_CLOCK_MS, Math.max(0, Math.round(playedMs))),
						clockStartedAt: match.clockStartedAt === null ? null : now,
						updatedAt: now
					})
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		/**
		 * Swaps a match with the one played right before or after it on the same day. Each keeps
		 * its teams and result; they trade places and kick-off times.
		 */
		moveMatch(id: number, direction: MoveDirection): void {
			db.transaction((tx) => {
				const match = requireMatch(tx, id);
				const dayMatches = tx
					.select({ id: matches.id, time: matches.time, slot: matches.slot })
					.from(matches)
					.where(eq(matches.matchDayId, match.matchDayId))
					.all()
					.sort(
						(a, b) =>
							(a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.slot - b.slot || a.id - b.id
					);
				const index = dayMatches.findIndex((candidate) => candidate.id === id);
				const other = dayMatches[index + (direction === 'earlier' ? -1 : 1)];
				if (!other) return;

				const current = dayMatches[index];
				const now = clock.now();
				tx.update(matches)
					.set({ slot: other.slot, time: other.time, updatedAt: now })
					.where(eq(matches.id, current.id))
					.run();
				tx.update(matches)
					.set({ slot: current.slot, time: current.time, updatedAt: now })
					.where(eq(matches.id, other.id))
					.run();
				touch(tx);
			});
		},

		/**
		 * Records a goal or a card. Goals and cards belong to a player; the exceptions are own
		 * goals and goals whose scorer nobody caught, which count for the team alone. The minute
		 * comes from the match clock unless one is given.
		 */
		addMatchEvent(matchId: number, input: MatchEventInput): number {
			if (!isOneOf(MATCH_EVENT_TYPES, input.type)) {
				throw new LeagueError('Ese tipo de evento no es válido.');
			}
			const goals = goalValue(input.type);
			if (input.playerId === null && goals === 0) {
				throw new LeagueError('Elige a quién se le mostró la tarjeta.');
			}
			const givenMinute = input.minute === undefined ? undefined : validateMinute(input.minute);

			return db.transaction((tx) => {
				const match = requirePlayableMatch(tx, matchId);
				const rules = readTournament(tx);
				if (isCard(input.type) && !rules.cards.includes(input.type)) {
					throw new LeagueError('Esa tarjeta no se usa en esta copa.');
				}
				if (input.type === 'double_goal' && !rules.doubleGoals) {
					throw new LeagueError('En esta copa ningún gol vale doble.');
				}
				const isHome = input.teamId === match.homeTeamId;
				if (!isHome && input.teamId !== match.awayTeamId) {
					throw new LeagueError('Ese equipo no juega este partido.');
				}
				let player: { id: number; name: string } | null = null;
				if (input.playerId !== null && input.type !== 'own_goal') {
					const found = tx.select().from(players).where(eq(players.id, input.playerId)).get();
					// A side that is short may borrow someone from a team that is not on the field.
					const isRival =
						found !== undefined &&
						found.teamId !== input.teamId &&
						(found.teamId === match.homeTeamId || found.teamId === match.awayTeamId);
					if (!found || isRival) {
						throw new LeagueError('Elige un jugador de ese equipo o uno prestado de otro.');
					}
					player = found;
				}

				const now = clock.now();
				const created = tx
					.insert(matchEvents)
					.values({
						matchId,
						teamId: input.teamId,
						playerId: player?.id ?? null,
						playerName: player?.name ?? '',
						type: input.type,
						minute: givenMinute === undefined ? minuteOfPlay(match, now) : givenMinute,
						createdAt: now
					})
					.returning({ id: matchEvents.id })
					.get();

				const score =
					goals === 0
						? {}
						: isHome
							? { homeScore: Math.min(MAX_SCORE, match.homeScore + goals) }
							: { awayScore: Math.min(MAX_SCORE, match.awayScore + goals) };
				tx.update(matches)
					.set({
						...score,
						status: match.status === 'pending' ? 'live' : match.status,
						updatedAt: now
					})
					.where(eq(matches.id, matchId))
					.run();
				touch(tx);
				return created.id;
			});
		},

		/** Corrects the minute of a goal or a card, or clears it with null. */
		setEventMinute(eventId: number, minute: number | null): void {
			const value = validateMinute(minute);
			db.transaction((tx) => {
				const updated = tx
					.update(matchEvents)
					.set({ minute: value })
					.where(eq(matchEvents.id, eventId))
					.returning({ id: matchEvents.id })
					.get();
				if (!updated) throw new LeagueError('Ese evento ya no existe.');
				touch(tx);
			});
		},

		/** Deletes a goal or a card. Deleting a goal takes it off the score. */
		removeMatchEvent(eventId: number): void {
			db.transaction((tx) => {
				const event = tx.select().from(matchEvents).where(eq(matchEvents.id, eventId)).get();
				if (!event) return;
				tx.delete(matchEvents).where(eq(matchEvents.id, eventId)).run();

				const goals = isOneOf(MATCH_EVENT_TYPES, event.type) ? goalValue(event.type) : 0;
				if (goals > 0) {
					const match = requireMatch(tx, event.matchId);
					const score =
						event.teamId === match.homeTeamId
							? { homeScore: Math.max(0, match.homeScore - goals) }
							: { awayScore: Math.max(0, match.awayScore - goals) };
					tx.update(matches)
						.set({ ...score, updatedAt: clock.now() })
						.where(eq(matches.id, match.id))
						.run();
				}
				touch(tx);
			});
		},

		/**
		 * Awards a match to the rival of the side that did not show up: a walkover. Nobody is
		 * credited with the goals, so nothing may have happened in the match yet.
		 */
		forfeitMatch(id: number, absent: Side): void {
			if (!isOneOf(SIDES, absent)) throw new LeagueError('Elige qué equipo no se presentó.');
			db.transaction((tx) => {
				requirePlayableMatch(tx, id);
				const played = tx
					.select({ id: matchEvents.id })
					.from(matchEvents)
					.where(eq(matchEvents.matchId, id))
					.get();
				if (played) {
					throw new LeagueError(
						'Este partido ya tiene goles o tarjetas. Borra el resultado antes de darlo por W.O.'
					);
				}
				tx.update(matches)
					.set({
						status: 'finished',
						homeScore: absent === 'home' ? 0 : FORFEIT_GOALS,
						awayScore: absent === 'home' ? FORFEIT_GOALS : 0,
						forfeitedBy: absent,
						clockStartedAt: null,
						clockElapsedMs: 0,
						updatedAt: clock.now()
					})
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		/** Forgets the result of a match: no score, no goals or cards, and back to pending. */
		resetMatch(id: number): void {
			db.transaction((tx) => {
				requireMatch(tx, id);
				tx.delete(matchEvents).where(eq(matchEvents.matchId, id)).run();
				tx.update(matches)
					.set({
						status: 'pending',
						homeScore: 0,
						awayScore: 0,
						forfeitedBy: null,
						clockStartedAt: null,
						clockElapsedMs: 0,
						updatedAt: clock.now()
					})
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		listAccessCodes(): AccessCode[] {
			return db
				.select({
					id: accessCodes.id,
					label: accessCodes.label,
					createdAt: accessCodes.createdAt,
					lastUsedAt: accessCodes.lastUsedAt
				})
				.from(accessCodes)
				.orderBy(asc(accessCodes.id))
				.all();
		},

		/** Registers a helper's code, given the hash of the code that was generated for them. */
		createAccessCode(label: string, codeHash: string): number {
			const name = requireText(label, 'el nombre de quien va a usar la clave', LIMITS.playerName);
			return db.transaction((tx) => {
				const total = tx.select({ value: count() }).from(accessCodes).get();
				if ((total?.value ?? 0) >= MAX_ACCESS_CODES) {
					throw new LeagueError(`Puede haber hasta ${MAX_ACCESS_CODES} claves de ayudante.`);
				}
				return tx
					.insert(accessCodes)
					.values({ label: name, codeHash, createdAt: clock.now() })
					.returning({ id: accessCodes.id })
					.get().id;
			});
		},

		/** Ends a helper's access: the code stops working and so do the sessions opened with it. */
		revokeAccessCode(id: number): void {
			db.delete(accessCodes).where(eq(accessCodes.id, id)).run();
		},

		/** The helper code with this hash, noting that it was just used, or null if there is none. */
		useAccessCode(codeHash: string): AccessCode | null {
			const found = db
				.update(accessCodes)
				.set({ lastUsedAt: clock.now() })
				.where(eq(accessCodes.codeHash, codeHash))
				.returning()
				.get();
			if (!found) return null;
			return {
				id: found.id,
				label: found.label,
				createdAt: found.createdAt,
				lastUsedAt: found.lastUsedAt
			};
		},

		/** The helper code with this id, or null once it has been revoked. */
		getAccessCode(id: number): AccessCode | null {
			const found = db.select().from(accessCodes).where(eq(accessCodes.id, id)).get();
			if (!found) return null;
			return {
				id: found.id,
				label: found.label,
				createdAt: found.createdAt,
				lastUsedAt: found.lastUsedAt
			};
		},

		clearSchedule(): void {
			db.transaction((tx) => {
				tx.delete(matches).run();
				touch(tx);
			});
		},

		/** Wipes teams, players, matches and settings, and starts again from the defaults. */
		resetTournament(): void {
			db.transaction((tx) => {
				tx.delete(matches).run();
				tx.delete(teams).run();
				tx.delete(matchDays).run();
				tx.delete(tournament).run();
				seedDefaults(tx);
			});
		}
	};
}

export type LeagueStore = ReturnType<typeof createLeagueStore>;
