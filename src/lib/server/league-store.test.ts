import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './db/client.ts';
import { LeagueError } from './errors.ts';
import { computeStandings } from '#lib/league/standings.ts';
import { createLeagueStore, type Clock, type LeagueStore } from './league-store.ts';

const MONDAY_BEFORE_THE_CUP = '2026-10-05';
const SATURDAYS = ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'];

let store: LeagueStore;
let time: number;

const clock: Clock = {
	now: () => ++time,
	today: () => MONDAY_BEFORE_THE_CUP
};

function addTeams(count: number): number[] {
	const colors = ['#16a34a', '#dc2626', '#f59e0b', '#2563eb', '#9333ea', '#0d9488'];
	return Array.from({ length: count }, (_, index) =>
		store.createTeam({ name: `Equipo ${index + 1}`, color: colors[index % colors.length] })
	);
}

function planDays() {
	return store
		.getLeague()
		.matchDays.map((day) => ({ id: day.id as number | null, date: day.date }));
}

function timing() {
	const { startTime, endTime, matchMinutes, breakMinutes } = store.getLeague().tournament;
	return { startTime, endTime, matchMinutes, breakMinutes };
}

beforeEach(() => {
	time = 1_000;
	store = createLeagueStore(openDatabase(':memory:'), clock);
});

describe('a new league', () => {
	it('starts with default settings and the next four Saturdays', () => {
		const league = store.getLeague();
		expect(league.tournament).toMatchObject({
			name: 'Copa Naiguatá',
			location: 'Naiguatá',
			playersOnField: 3,
			pointsWin: 3,
			pointsDraw: 1,
			pointsLoss: 0
		});
		expect(league.matchDays.map((day) => day.date)).toEqual(SATURDAYS);
		expect(league.matchDays.map((day) => day.number)).toEqual([1, 2, 3, 4]);
		expect(league.teams).toEqual([]);
		expect(league.matches).toEqual([]);
	});

	it('does not seed again when the store is created over an existing database', () => {
		const db = openDatabase(':memory:');
		const first = createLeagueStore(db, clock);
		first.updateSettings({
			name: 'Liga del barrio',
			location: 'La Guaira',
			venue: '',
			playersOnField: 5
		});
		const second = createLeagueStore(db, { ...clock, today: () => '2027-01-01' });
		expect(second.getLeague().tournament.name).toBe('Liga del barrio');
		expect(second.getLeague().matchDays.map((day) => day.date)).toEqual(SATURDAYS);
	});
});

describe('settings', () => {
	it('saves trimmed values and marks the league as updated', () => {
		const before = store.getLeague().tournament.updatedAt;
		store.updateSettings({
			name: '  Copa   de Verano ',
			location: 'Naiguatá',
			venue: ' Cancha del malecón ',
			playersOnField: 4
		});
		const { tournament } = store.getLeague();
		expect(tournament).toMatchObject({
			name: 'Copa de Verano',
			venue: 'Cancha del malecón',
			playersOnField: 4
		});
		expect(tournament.updatedAt).toBeGreaterThan(before);
	});

	it('requires at least three players on the field', () => {
		const settings = { name: 'Copa', location: 'Naiguatá', venue: '', playersOnField: 2 };
		expect(() => store.updateSettings(settings)).toThrow(LeagueError);
	});
});

describe('teams', () => {
	it('creates teams with their players', () => {
		const id = store.createTeam({ name: 'Los Tiburones', color: '#2563EB' });
		store.addPlayer(id, { name: 'Luis Marcano', number: '10', position: 'FWD' });
		store.addPlayer(id, { name: 'José Brito', number: 'n.º 7', position: null });

		const [team] = store.getLeague().teams;
		expect(team).toMatchObject({ id, name: 'Los Tiburones', color: '#2563eb' });
		expect(team.players.map((player) => [player.name, player.number, player.position])).toEqual([
			['Luis Marcano', '10', 'FWD'],
			['José Brito', '7', null]
		]);
	});

	it('rejects a repeated name regardless of capitalisation', () => {
		store.createTeam({ name: 'Los Tiburones', color: '#2563eb' });
		expect(() => store.createTeam({ name: 'los tiburones', color: '#dc2626' })).toThrow(
			/Ya existe un equipo/
		);
	});

	it('rejects an empty name and an invalid colour', () => {
		expect(() => store.createTeam({ name: '   ', color: '#2563eb' })).toThrow(LeagueError);
		expect(() => store.createTeam({ name: 'Rayos', color: 'blue' })).toThrow(LeagueError);
	});

	it('lets a team keep its own name when it is edited', () => {
		const id = store.createTeam({ name: 'Rayos', color: '#2563eb' });
		store.updateTeam(id, { name: 'Rayos', color: '#dc2626' });
		expect(store.getLeague().teams[0].color).toBe('#dc2626');
	});

	it('edits and removes players', () => {
		const teamId = store.createTeam({ name: 'Rayos', color: '#2563eb' });
		const playerId = store.addPlayer(teamId, { name: 'Pedro', number: null, position: null });
		store.updatePlayer(playerId, { name: 'Pedro Rojas', number: '1', position: 'GK' });
		expect(store.getLeague().teams[0].players[0]).toMatchObject({
			name: 'Pedro Rojas',
			number: '1',
			position: 'GK'
		});

		store.deletePlayer(playerId);
		expect(store.getLeague().teams[0].players).toEqual([]);
	});

	it('removes the players and matches of a deleted team', () => {
		const ids = addTeams(4);
		store.addPlayer(ids[0], { name: 'Pedro', number: null, position: null });
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });

		store.deleteTeam(ids[0]);
		const league = store.getLeague();
		expect(league.teams).toHaveLength(3);
		expect(league.matches).toHaveLength(3);
		expect(league.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])).not.toContain(ids[0]);
	});
});

describe('generating the calendar', () => {
	it('schedules every match with a day and a kick-off time', () => {
		addTeams(6);
		const result = store.generateSchedule({ legs: 2, matchesPerDay: [9, 9, 6, 6], random: false });
		expect(result.matchCount).toBe(30);

		const league = store.getLeague();
		expect(league.tournament.legs).toBe(2);
		const firstDay = league.matches.filter((match) => match.matchDayId === league.matchDays[0].id);
		expect(firstDay.map((match) => match.time)).toEqual([
			'09:00',
			'09:25',
			'09:50',
			'10:15',
			'10:40',
			'11:05',
			'11:30',
			'11:55',
			'12:20'
		]);
		expect(league.matches.every((match) => match.status === 'pending')).toBe(true);
	});

	it('replaces the previous calendar', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		store.generateSchedule({ legs: 2, matchesPerDay: [3, 3, 3, 3], random: true });
		expect(store.getLeague().matches).toHaveLength(12);
	});

	it('needs at least two teams', () => {
		addTeams(1);
		expect(() =>
			store.generateSchedule({ legs: 1, matchesPerDay: [0, 0, 0, 0], random: false })
		).toThrow(/al menos 2 equipos/);
	});

	it('refuses a plan whose days do not add up to the format', () => {
		addTeams(4);
		expect(() =>
			store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 2, 2], random: false })
		).toThrow(/suman 8, pero el formato tiene 6/);
		expect(store.getLeague().matches).toEqual([]);
	});

	it('can change the match days and timetable in the same step', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });

		const [first, second] = planDays();
		store.generateSchedule({
			plan: {
				days: [first, { ...second, date: '2026-10-18' }],
				timing: { startTime: '16:00', endTime: '19:00', matchMinutes: 15, breakMinutes: 5 }
			},
			legs: 1,
			matchesPerDay: [3, 3],
			random: false
		});

		const league = store.getLeague();
		expect(league.matchDays.map((day) => day.date)).toEqual(['2026-10-10', '2026-10-18']);
		expect(league.matches.map((match) => match.time)).toEqual([
			'16:00',
			'16:20',
			'16:40',
			'16:00',
			'16:20',
			'16:40'
		]);
	});

	it('keeps the old calendar when the new plan is rejected', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		const before = store.getLeague();

		expect(() =>
			store.generateSchedule({
				plan: { days: planDays().slice(0, 2), timing: timing() },
				legs: 1,
				matchesPerDay: [2, 2],
				random: false
			})
		).toThrow(LeagueError);

		const after = store.getLeague();
		expect(after.matches).toEqual(before.matches);
		expect(after.matchDays).toEqual(before.matchDays);
	});

	it('lists matches by day and then by kick-off time', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		const league = store.getLeague();
		const dayNumber = new Map(league.matchDays.map((day) => [day.id, day.number]));
		const order = league.matches.map((m) => `${dayNumber.get(m.matchDayId)} ${m.time}`);
		expect(order).toEqual([...order].sort());
	});
});

describe('match days and timetable', () => {
	it('moves a day to another date, taking its matches along', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		const days = planDays();
		days[1].date = '2026-10-18';
		store.savePlan({ days, timing: timing() });

		const league = store.getLeague();
		expect(league.matchDays.map((day) => day.date)).toEqual([
			'2026-10-10',
			'2026-10-18',
			'2026-10-24',
			'2026-10-31'
		]);
		expect(league.matches.filter((m) => m.matchDayId === days[1].id)).toHaveLength(2);
	});

	it('lets two days swap dates', () => {
		const days = planDays();
		[days[0].date, days[1].date] = [days[1].date, days[0].date];
		store.savePlan({ days, timing: timing() });
		const byId = new Map(store.getLeague().matchDays.map((day) => [day.id, day.date]));
		expect(byId.get(days[0].id as number)).toBe('2026-10-17');
		expect(byId.get(days[1].id as number)).toBe('2026-10-10');
	});

	it('adds and removes days that have no matches', () => {
		const days = planDays();
		store.savePlan({
			days: [...days.slice(0, 3), { id: null, date: '2026-11-07' }],
			timing: timing()
		});
		expect(store.getLeague().matchDays.map((day) => day.date)).toEqual([
			'2026-10-10',
			'2026-10-17',
			'2026-10-24',
			'2026-11-07'
		]);
	});

	it('refuses to remove a day that still has matches', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		expect(() => store.savePlan({ days: planDays().slice(1), timing: timing() })).toThrow(
			/sábado 10 de octubre tiene partidos/
		);
		expect(store.getLeague().matchDays).toHaveLength(4);
	});

	it('rejects repeated or invalid dates', () => {
		const days = planDays();
		days[1].date = days[0].date;
		expect(() => store.savePlan({ days, timing: timing() })).toThrow(/misma fecha/);
		expect(() =>
			store.savePlan({ days: [{ id: null, date: '2026-13-01' }], timing: timing() })
		).toThrow(LeagueError);
	});

	it('recalculates kick-off times when the timetable changes', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		const result = store.savePlan({
			days: planDays(),
			timing: { startTime: '15:00', endTime: '18:00', matchMinutes: 30, breakMinutes: 10 }
		});
		expect(result.retimed).toBe(true);

		const league = store.getLeague();
		const firstDay = league.matches.filter((match) => match.matchDayId === league.matchDays[0].id);
		expect(firstDay.map((match) => match.time)).toEqual(['15:00', '15:40']);
	});

	it('leaves kick-off times alone when only the end time changes', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		const result = store.savePlan({ days: planDays(), timing: { ...timing(), endTime: '14:00' } });
		expect(result.retimed).toBe(false);
	});

	it('requires the end time to come after the start time', () => {
		expect(() =>
			store.savePlan({ days: planDays(), timing: { ...timing(), endTime: '08:00' } })
		).toThrow(/posterior a la hora de inicio/);
	});
});

describe('editing a match', () => {
	it('moves a match to the end of another day', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		const before = store.getLeague();
		const match = before.matches[0];
		const lastDay = before.matchDays[3];

		store.updateMatchSchedule(match.id, {
			matchDayId: lastDay.id,
			time: '10:30',
			venue: ' Cancha techada '
		});

		const moved = store.getLeague().matches.find((candidate) => candidate.id === match.id);
		expect(moved).toMatchObject({
			matchDayId: lastDay.id,
			time: '10:30',
			venue: 'Cancha techada',
			slot: 1
		});
	});

	it('rejects an invalid time', () => {
		addTeams(2);
		store.generateSchedule({ legs: 1, matchesPerDay: [1, 0, 0, 0], random: false });
		const league = store.getLeague();
		expect(() =>
			store.updateMatchSchedule(league.matches[0].id, {
				matchDayId: league.matchDays[0].id,
				time: '25:00',
				venue: null
			})
		).toThrow(LeagueError);
	});
});

describe('recording results', () => {
	/** Two teams with one player each and a single match between them. */
	function kickOff() {
		const [homeId, awayId] = addTeams(2);
		const scorer = store.addPlayer(homeId, { name: 'Luis Marcano', number: '10', position: 'FWD' });
		const keeper = store.addPlayer(awayId, { name: 'Pedro Rojas', number: '1', position: 'GK' });
		store.generateSchedule({ legs: 1, matchesPerDay: [1, 0, 0, 0], random: false });
		const matchId = store.getLeague().matches[0].id;
		return { homeId, awayId, scorer, keeper, matchId };
	}

	function theMatch() {
		return store.getLeague().matches[0];
	}

	it('counts a goal for the scorer and starts the match', () => {
		const { homeId, scorer, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });

		expect(theMatch()).toMatchObject({ status: 'live', homeScore: 1, awayScore: 0 });
		expect(theMatch().events).toMatchObject([
			{ teamId: homeId, playerId: scorer, playerName: 'Luis Marcano', type: 'goal' }
		]);
	});

	it('records cards without changing the score', () => {
		const { awayId, keeper, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: awayId, playerId: keeper, type: 'yellow' });
		store.addMatchEvent(matchId, { teamId: awayId, playerId: keeper, type: 'red' });

		expect(theMatch()).toMatchObject({ homeScore: 0, awayScore: 0 });
		expect(theMatch().events.map((event) => event.type)).toEqual(['yellow', 'red']);
	});

	it('only accepts players of the teams on the field', () => {
		const { homeId, awayId, keeper, matchId } = kickOff();
		const outsider = store.createTeam({ name: 'Visitantes', color: '#000000' });
		const stranger = store.addPlayer(outsider, { name: 'Otro', number: null, position: null });

		expect(() =>
			store.addMatchEvent(matchId, { teamId: homeId, playerId: keeper, type: 'goal' })
		).toThrow(/jugador de ese equipo/);
		expect(() =>
			store.addMatchEvent(matchId, { teamId: outsider, playerId: stranger, type: 'goal' })
		).toThrow(/no juega este partido/);
		expect(theMatch().events).toEqual([]);
		expect(awayId).not.toBe(outsider);
	});

	it('takes a deleted goal off the score', () => {
		const { homeId, scorer, matchId } = kickOff();
		const first = store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		store.removeMatchEvent(first);

		expect(theMatch()).toMatchObject({ homeScore: 1 });
		expect(theMatch().events).toHaveLength(1);
	});

	it('counts a double goal as two, and takes both off when it is deleted', () => {
		const { homeId, scorer, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		const double = store.addMatchEvent(matchId, {
			teamId: homeId,
			playerId: scorer,
			type: 'double_goal'
		});
		expect(theMatch()).toMatchObject({ homeScore: 3, awayScore: 0 });
		expect(theMatch().events.map((event) => event.type)).toEqual(['goal', 'double_goal']);

		store.removeMatchEvent(double);
		expect(theMatch()).toMatchObject({ homeScore: 1 });
	});

	it('shows a blue card to a player, never to nobody', () => {
		const { awayId, keeper, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: awayId, playerId: keeper, type: 'blue' });
		expect(theMatch()).toMatchObject({ homeScore: 0, awayScore: 0 });
		expect(theMatch().events).toMatchObject([{ playerId: keeper, type: 'blue' }]);
		expect(() =>
			store.addMatchEvent(matchId, { teamId: awayId, playerId: null, type: 'blue' })
		).toThrow(/a quién se le mostró/);
	});

	it('counts an own goal for the team, with no scorer', () => {
		const { homeId, keeper, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: homeId, playerId: keeper, type: 'own_goal' });
		expect(theMatch()).toMatchObject({ homeScore: 1, awayScore: 0 });
		expect(theMatch().events).toMatchObject([{ playerId: null, playerName: '', type: 'own_goal' }]);
	});

	it('accepts a goal whose scorer nobody caught, but not a card for nobody', () => {
		const { awayId, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: awayId, playerId: null, type: 'goal' });
		expect(theMatch()).toMatchObject({ awayScore: 1 });
		expect(() =>
			store.addMatchEvent(matchId, { teamId: awayId, playerId: null, type: 'yellow' })
		).toThrow(/a quién se le mostró/);
	});

	it('changes the status of a match', () => {
		const { matchId } = kickOff();
		store.setMatchStatus(matchId, 'finished');
		expect(theMatch().status).toBe('finished');
		store.setMatchStatus(matchId, 'pending');
		expect(theMatch().status).toBe('pending');
		expect(() => store.setMatchStatus(999, 'live')).toThrow(LeagueError);
	});

	it('keeps the name on the goals of a player who is later removed', () => {
		const { homeId, scorer, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		store.deletePlayer(scorer);

		expect(theMatch().events).toMatchObject([{ playerId: null, playerName: 'Luis Marcano' }]);
		expect(theMatch().homeScore).toBe(1);
	});

	it('forgets a result when the match is reset', () => {
		const { homeId, scorer, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		store.setMatchStatus(matchId, 'finished');
		store.resetMatch(matchId);

		expect(theMatch()).toMatchObject({ status: 'pending', homeScore: 0, awayScore: 0, events: [] });
	});

	it('awards a match five-nil to the rival of the team that did not show up', () => {
		const { matchId } = kickOff();
		store.forfeitMatch(matchId, 'home');
		expect(theMatch()).toMatchObject({
			status: 'finished',
			homeScore: 0,
			awayScore: 5,
			forfeitedBy: 'home',
			clockStartedAt: null,
			clockElapsedMs: 0,
			events: []
		});
	});

	it('does not let a forfeited match be played until its result is cleared', () => {
		const { homeId, scorer, matchId } = kickOff();
		store.forfeitMatch(matchId, 'away');
		expect(theMatch()).toMatchObject({ homeScore: 5, awayScore: 0, forfeitedBy: 'away' });

		const byWalkover = /se dio por W\.O\./;
		expect(() => store.startMatch(matchId)).toThrow(byWalkover);
		expect(() => store.setMatchStatus(matchId, 'pending')).toThrow(byWalkover);
		expect(() => store.forfeitMatch(matchId, 'home')).toThrow(byWalkover);
		expect(() =>
			store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' })
		).toThrow(byWalkover);
		expect(theMatch()).toMatchObject({ homeScore: 5, awayScore: 0, events: [] });

		store.resetMatch(matchId);
		expect(theMatch()).toMatchObject({ status: 'pending', homeScore: 0, forfeitedBy: null });
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		expect(theMatch()).toMatchObject({ status: 'live', homeScore: 1 });
	});

	it('refuses a walkover once the match has goals or cards', () => {
		const { homeId, scorer, matchId } = kickOff();
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		expect(() => store.forfeitMatch(matchId, 'away')).toThrow(/ya tiene goles o tarjetas/);
		expect(theMatch()).toMatchObject({ homeScore: 1, forfeitedBy: null });
	});

	it('gives the points of a walkover to the team that showed up', () => {
		const { homeId, awayId, matchId } = kickOff();
		store.forfeitMatch(matchId, 'home');
		const league = store.getLeague();
		const table = computeStandings(league.teams, league.matches, league.tournament);
		expect(table.map((row) => [row.teamId, row.points, row.goalDifference])).toEqual([
			[awayId, 3, 5],
			[homeId, 0, -5]
		]);
	});

	it('marks the league as updated on every change', () => {
		const { matchId } = kickOff();
		const before = store.getLeague().tournament.updatedAt;
		store.startMatch(matchId);
		expect(store.getLeague().tournament.updatedAt).toBeGreaterThan(before);
	});
});

describe('starting over', () => {
	it('clears the calendar but keeps the teams', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		store.clearSchedule();
		const league = store.getLeague();
		expect(league.matches).toEqual([]);
		expect(league.teams).toHaveLength(4);
	});

	it('resets the whole tournament to its defaults', () => {
		addTeams(4);
		store.updateSettings({ name: 'Otra copa', location: 'Caracas', venue: '', playersOnField: 5 });
		store.generateSchedule({ legs: 1, matchesPerDay: [2, 2, 1, 1], random: false });
		store.resetTournament();

		const league = store.getLeague();
		expect(league.tournament.name).toBe('Copa Naiguatá');
		expect(league.teams).toEqual([]);
		expect(league.matches).toEqual([]);
		expect(league.matchDays.map((day) => day.date)).toEqual(SATURDAYS);
	});
});

describe('the match clock', () => {
	const MINUTE = 60_000;

	function kickOff() {
		time = 1_000_000;
		const [homeId] = addTeams(2);
		const scorer = store.addPlayer(homeId, { name: 'Luis Marcano', number: '10', position: null });
		store.generateSchedule({ legs: 1, matchesPerDay: [1, 0, 0, 0], random: false });
		return { homeId, scorer, matchId: store.getLeague().matches[0].id };
	}

	const theMatch = () => store.getLeague().matches[0];
	const wait = (milliseconds: number) => (time += milliseconds);

	it('runs from kick-off, keeps its time across a pause and stops at the end', () => {
		const { matchId } = kickOff();
		store.startMatch(matchId);
		expect(theMatch().status).toBe('live');
		wait(10 * MINUTE);
		store.pauseMatch(matchId);
		expect(theMatch().clockStartedAt).toBeNull();
		expect(Math.floor(theMatch().clockElapsedMs / MINUTE)).toBe(10);

		wait(5 * MINUTE);
		store.startMatch(matchId);
		wait(2 * MINUTE);
		store.finishMatch(matchId);
		expect(theMatch()).toMatchObject({ status: 'finished', clockStartedAt: null });
		expect(Math.floor(theMatch().clockElapsedMs / MINUTE)).toBe(12);
	});

	it('stamps goals and cards with the minute being played', () => {
		const { homeId, scorer, matchId } = kickOff();
		store.startMatch(matchId);
		store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'goal' });
		wait(7 * MINUTE);
		const card = store.addMatchEvent(matchId, { teamId: homeId, playerId: scorer, type: 'yellow' });
		expect(theMatch().events.map((event) => event.minute)).toEqual([1, 8]);

		store.setEventMinute(card, 19);
		expect(theMatch().events[1].minute).toBe(19);
		expect(() => store.setEventMinute(card, 0)).toThrow(LeagueError);
	});

	it('can be set by hand and goes back to zero when the result is cleared', () => {
		const { matchId } = kickOff();
		store.startMatch(matchId);
		wait(4 * MINUTE);
		store.setClock(matchId, 15 * MINUTE);
		wait(MINUTE);
		store.pauseMatch(matchId);
		expect(Math.floor(theMatch().clockElapsedMs / MINUTE)).toBe(16);

		store.resetMatch(matchId);
		expect(theMatch()).toMatchObject({
			status: 'pending',
			clockStartedAt: null,
			clockElapsedMs: 0
		});
	});
});

describe('order of play', () => {
	it('swaps a match with its neighbour, trading kick-off times', () => {
		addTeams(4);
		store.generateSchedule({ legs: 1, matchesPerDay: [3, 3, 0, 0], random: false });
		const dayOne = () => {
			const league = store.getLeague();
			return league.matches.filter((match) => match.matchDayId === league.matchDays[0].id);
		};
		const [first, second, third] = dayOne();

		store.moveMatch(first.id, 'later');
		expect(dayOne().map((match) => match.id)).toEqual([second.id, first.id, third.id]);
		expect(dayOne().map((match) => match.time)).toEqual(['09:00', '09:25', '09:50']);

		store.moveMatch(second.id, 'earlier');
		expect(dayOne().map((match) => match.id)).toEqual([second.id, first.id, third.id]);
	});
});

describe('adding many at once', () => {
	it('creates teams with players and different colours, skipping taken names', () => {
		store.createTeam({ name: 'Rayos', color: '#2563eb' });
		const result = store.createTeams([
			{ name: 'rayos', players: [] },
			{ name: 'Truenos', players: [{ name: 'Ana', number: '7', position: null }] },
			{ name: 'Centellas', players: [] }
		]);
		expect(result).toEqual({ created: ['Truenos', 'Centellas'], skipped: ['rayos'] });

		const { teams } = store.getLeague();
		expect(new Set(teams.map((team) => team.color)).size).toBe(3);
		expect(teams[1].players).toMatchObject([{ name: 'Ana', number: '7' }]);
	});

	it('adds a list of players to a team', () => {
		const teamId = store.createTeam({ name: 'Rayos', color: '#2563eb' });
		expect(
			store.addPlayers(teamId, [
				{ name: 'Ana', number: null, position: null },
				{ name: 'Luis', number: '10', position: null }
			])
		).toBe(2);
		expect(() => store.addPlayers(teamId, [])).toThrow(LeagueError);
	});
});

describe('helper access codes', () => {
	it('are listed with who they are for, and found by their hash', () => {
		const id = store.createAccessCode('  Pedro  ', 'hash-of-pedro');
		expect(store.listAccessCodes()).toMatchObject([{ id, label: 'Pedro', lastUsedAt: null }]);

		expect(store.useAccessCode('hash-of-someone-else')).toBeNull();
		expect(store.useAccessCode('hash-of-pedro')).toMatchObject({ id, label: 'Pedro' });
		expect(store.listAccessCodes()[0].lastUsedAt).toBeGreaterThan(0);
	});

	it('stop existing once revoked', () => {
		const id = store.createAccessCode('Pedro', 'hash-of-pedro');
		expect(store.getAccessCode(id)).toMatchObject({ label: 'Pedro' });

		store.revokeAccessCode(id);
		expect(store.getAccessCode(id)).toBeNull();
		expect(store.useAccessCode('hash-of-pedro')).toBeNull();
		expect(store.listAccessCodes()).toEqual([]);
	});

	it('need a name and survive a tournament reset', () => {
		expect(() => store.createAccessCode('   ', 'hash')).toThrow(LeagueError);
		store.createAccessCode('Pedro', 'hash-of-pedro');
		store.resetTournament();
		expect(store.listAccessCodes()).toHaveLength(1);
	});
});
