export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;
export type Position = (typeof POSITIONS)[number];

export const MATCH_STATUSES = ['pending', 'live', 'finished'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/**
 * `own_goal` is a goal put in by the other side: it counts for the team it is recorded under,
 * and for no scorer.
 */
export const MATCH_EVENT_TYPES = ['goal', 'own_goal', 'yellow', 'red'] as const;
export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

export function countsAsGoal(type: MatchEventType): boolean {
	return type === 'goal' || type === 'own_goal';
}

export interface Player {
	id: number;
	teamId: number;
	name: string;
	/** Shirt number, kept as text so "07" stays "07". */
	number: string | null;
	position: Position | null;
}

export interface Team {
	id: number;
	name: string;
	/** Hex colour such as `#1f9d55`. */
	color: string;
	players: Player[];
}

export interface MatchDay {
	id: number;
	/** `YYYY-MM-DD` */
	date: string;
	/** 1-based position of the day within the tournament, ordered by date. */
	number: number;
}

export interface MatchEvent {
	id: number;
	matchId: number;
	teamId: number;
	/** Null when the player was not named, or has since left the roster. */
	playerId: number | null;
	/** Name at the time of the event. Empty when the player was not named. */
	playerName: string;
	type: MatchEventType;
	/** Minute of play, counting from 1, or null when it was not timed. */
	minute: number | null;
}

export interface Match {
	id: number;
	matchDayId: number;
	round: number;
	leg: number;
	slot: number;
	/** `HH:MM` */
	time: string | null;
	venue: string | null;
	homeTeamId: number;
	awayTeamId: number;
	status: MatchStatus;
	homeScore: number;
	awayScore: number;
	/** Epoch milliseconds since which the match clock is running, or null while it is stopped. */
	clockStartedAt: number | null;
	/** Playing time, in milliseconds, accumulated before the clock was last started. */
	clockElapsedMs: number;
	events: MatchEvent[];
}

export interface Tournament {
	name: string;
	location: string;
	/** Default venue shown on matches that do not set their own. */
	venue: string;
	playersOnField: number;
	pointsWin: number;
	pointsDraw: number;
	pointsLoss: number;
	/** How many times each pair of teams meets. */
	legs: number;
	/** `HH:MM` */
	startTime: string;
	/** `HH:MM` */
	endTime: string;
	matchMinutes: number;
	breakMinutes: number;
	/** Epoch milliseconds of the last change to any league data. */
	updatedAt: number;
}

export interface League {
	tournament: Tournament;
	matchDays: MatchDay[];
	teams: Team[];
	matches: Match[];
}

export const LIMITS = {
	teamName: 40,
	playerName: 40,
	leagueName: 60,
	location: 60,
	venue: 60,
	minPlayersOnField: 3,
	maxPlayersOnField: 11,
	maxTeams: 24,
	maxMatchDays: 12,
	maxLegs: 4,
	minMatchMinutes: 5,
	maxMatchMinutes: 120,
	maxBreakMinutes: 60,
	/** The clock stops counting here, so a forgotten match cannot run for days. */
	maxClockMinutes: 240
} as const;
