import { and, asc, count, eq, max } from 'drizzle-orm';
import {
	formatDate,
	isClockTime,
	isIsoDate,
	nextWeekdayDates,
	todayIso,
	toMinutes
} from '#lib/league/format.ts';
import { buildSchedule, slotTime, totalMatches, type PlanTiming } from '#lib/league/schedule.ts';
import {
	LIMITS,
	MATCH_EVENT_TYPES,
	MATCH_STATUSES,
	POSITIONS,
	type League,
	type Match,
	type MatchEvent,
	type MatchEventType,
	type MatchSide,
	type MatchStatus,
	type Player,
	type Position,
	type Team,
	type Tournament
} from '#lib/league/types.ts';
import type { Db } from './db/client.ts';
import { matchDays, matchEvents, matches, players, teams, tournament } from './db/schema.ts';
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
	playerId: number;
	type: MatchEventType;
}

const MAX_SCORE = 99;

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
				)
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
				requireMatch(tx, id);
				tx.update(matches).set({ status, updatedAt: clock.now() }).where(eq(matches.id, id)).run();
				touch(tx);
			});
		},

		/**
		 * Adds or takes away one goal without saying who scored it. The score never drops below
		 * the goals that do have a scorer; those are removed with {@link removeMatchEvent}.
		 */
		adjustScore(id: number, side: MatchSide, delta: 1 | -1): void {
			db.transaction((tx) => {
				const match = requireMatch(tx, id);
				const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
				const credited =
					tx
						.select({ value: count() })
						.from(matchEvents)
						.where(
							and(
								eq(matchEvents.matchId, id),
								eq(matchEvents.teamId, teamId),
								eq(matchEvents.type, 'goal')
							)
						)
						.get()?.value ?? 0;
				const current = side === 'home' ? match.homeScore : match.awayScore;
				const next = Math.min(MAX_SCORE, Math.max(credited, current + delta));
				if (next === current) return;

				tx.update(matches)
					.set({
						...(side === 'home' ? { homeScore: next } : { awayScore: next }),
						// Touching the score of a match that had not started means it is under way.
						status: match.status === 'pending' ? 'live' : match.status,
						updatedAt: clock.now()
					})
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
		},

		/** Records a goal or a card for a player. A goal also adds to the score. */
		addMatchEvent(matchId: number, input: MatchEventInput): number {
			if (!isOneOf(MATCH_EVENT_TYPES, input.type)) {
				throw new LeagueError('Ese tipo de evento no es válido.');
			}
			return db.transaction((tx) => {
				const match = requireMatch(tx, matchId);
				const isHome = input.teamId === match.homeTeamId;
				if (!isHome && input.teamId !== match.awayTeamId) {
					throw new LeagueError('Ese equipo no juega este partido.');
				}
				const player = tx.select().from(players).where(eq(players.id, input.playerId)).get();
				if (!player || player.teamId !== input.teamId) {
					throw new LeagueError('Elige un jugador de ese equipo.');
				}

				const now = clock.now();
				const created = tx
					.insert(matchEvents)
					.values({
						matchId,
						teamId: input.teamId,
						playerId: player.id,
						playerName: player.name,
						type: input.type,
						createdAt: now
					})
					.returning({ id: matchEvents.id })
					.get();

				const score =
					input.type !== 'goal'
						? {}
						: isHome
							? { homeScore: Math.min(MAX_SCORE, match.homeScore + 1) }
							: { awayScore: Math.min(MAX_SCORE, match.awayScore + 1) };
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

		/** Deletes a goal or a card. Deleting a goal takes it off the score. */
		removeMatchEvent(eventId: number): void {
			db.transaction((tx) => {
				const event = tx.select().from(matchEvents).where(eq(matchEvents.id, eventId)).get();
				if (!event) return;
				tx.delete(matchEvents).where(eq(matchEvents.id, eventId)).run();

				if (event.type === 'goal') {
					const match = requireMatch(tx, event.matchId);
					const score =
						event.teamId === match.homeTeamId
							? { homeScore: Math.max(0, match.homeScore - 1) }
							: { awayScore: Math.max(0, match.awayScore - 1) };
					tx.update(matches)
						.set({ ...score, updatedAt: clock.now() })
						.where(eq(matches.id, match.id))
						.run();
				}
				touch(tx);
			});
		},

		/** Forgets the result of a match: no score, no goals or cards, and back to pending. */
		resetMatch(id: number): void {
			db.transaction((tx) => {
				requireMatch(tx, id);
				tx.delete(matchEvents).where(eq(matchEvents.matchId, id)).run();
				tx.update(matches)
					.set({ status: 'pending', homeScore: 0, awayScore: 0, updatedAt: clock.now() })
					.where(eq(matches.id, id))
					.run();
				touch(tx);
			});
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
