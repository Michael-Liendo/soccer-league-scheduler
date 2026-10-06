import type { MatchStatus, Position } from './types.ts';

/** Text shown to people for the values the code keeps in English. */

export const POSITION_LABELS: Record<Position, string> = {
	GK: 'Portero',
	DEF: 'Defensa',
	MID: 'Medio',
	FWD: 'Delantero'
};

export const STATUS_LABELS: Record<MatchStatus, string> = {
	pending: 'Por jugar',
	live: 'En vivo',
	finished: 'Finalizado'
};

export const LEG_LABELS: Record<number, string> = {
	1: 'Una vuelta',
	2: 'Dos vueltas',
	3: 'Tres vueltas',
	4: 'Cuatro vueltas'
};

export const LEG_DESCRIPTIONS: Record<number, string> = {
	1: 'Cada equipo enfrenta una vez a cada rival.',
	2: 'Ida y vuelta: dos partidos contra cada rival.',
	3: 'Tres partidos contra cada rival.',
	4: 'Ida y vuelta doble: cuatro partidos contra cada rival.'
};

/** Colours offered to new teams, in the order they are handed out. */
export const TEAM_COLORS = [
	'#16a34a',
	'#dc2626',
	'#f59e0b',
	'#2563eb',
	'#9333ea',
	'#0d9488',
	'#ec4899',
	'#84cc16',
	'#f97316',
	'#0ea5e9',
	'#facc15',
	'#64748b'
];

/** The first palette colour no team is wearing yet, falling back to cycling through them. */
export function nextTeamColor(usedColors: readonly string[]): string {
	const used = new Set(usedColors.map((color) => color.toLowerCase()));
	return (
		TEAM_COLORS.find((color) => !used.has(color)) ??
		TEAM_COLORS[usedColors.length % TEAM_COLORS.length]
	);
}
