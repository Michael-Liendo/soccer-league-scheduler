import { describe, expect, it } from 'vitest';
import { parsePlayer, parsePlayers, parseTeams } from './roster-text.ts';

describe('parsePlayer', () => {
	it('reads a plain name', () => {
		expect(parsePlayer('  Luis   Marcano ')).toEqual({ name: 'Luis Marcano', number: null });
	});

	it('takes a leading shirt number', () => {
		expect(parsePlayer('10 Luis Marcano')).toEqual({ name: 'Luis Marcano', number: '10' });
		expect(parsePlayer('#7 - Ana')).toEqual({ name: 'Ana', number: '7' });
		expect(parsePlayer('1. Pedro Rojas')).toEqual({ name: 'Pedro Rojas', number: '1' });
	});

	it('drops bullets copied from a chat', () => {
		expect(parsePlayer('- Carlos Pérez')).toEqual({ name: 'Carlos Pérez', number: null });
		expect(parsePlayer('• 9 José Brito')).toEqual({ name: 'José Brito', number: '9' });
	});

	it('finds no player in an empty line or a bare number', () => {
		expect(parsePlayer('   ')).toBeNull();
		expect(parsePlayer('10')).toBeNull();
		expect(parsePlayer('-')).toBeNull();
	});

	it('keeps numbers that are part of the name', () => {
		expect(parsePlayer('Juan 2')).toEqual({ name: 'Juan 2', number: null });
	});
});

describe('parsePlayers', () => {
	it('splits on line breaks, commas and semicolons', () => {
		expect(parsePlayers('Luis, 9 Pedro; Ana\n\nCarlos').map((player) => player.name)).toEqual([
			'Luis',
			'Pedro',
			'Ana',
			'Carlos'
		]);
	});
});

describe('parseTeams', () => {
	it('reads one team per line', () => {
		expect(parseTeams('Los Tiburones\n\n  Deportivo Camurí  ')).toEqual([
			{ name: 'Los Tiburones', players: [] },
			{ name: 'Deportivo Camurí', players: [] }
		]);
	});

	it('reads the players after a colon', () => {
		expect(parseTeams('Los Tiburones: 10 Luis Marcano, Pedro Rojas')).toEqual([
			{
				name: 'Los Tiburones',
				players: [
					{ name: 'Luis Marcano', number: '10' },
					{ name: 'Pedro Rojas', number: null }
				]
			}
		]);
	});

	it('keeps the first of two lines with the same team', () => {
		const teams = parseTeams('Rayos: Ana\nrayos: Luis\nTruenos');
		expect(teams.map((team) => team.name)).toEqual(['Rayos', 'Truenos']);
		expect(teams[0].players).toHaveLength(1);
	});

	it('skips lines without a team name', () => {
		expect(parseTeams(': Luis, Ana\n-\n')).toEqual([]);
	});
});
