/**
 * Reads teams and players typed or pasted as plain text, the way rosters travel over chat:
 *
 *     Los Tiburones: 10 Luis Marcano, Pedro Rojas, 1 Carlos Pérez
 *     Deportivo Camurí
 */

export interface TypedPlayer {
	name: string;
	/** Shirt number, when the line started with one. */
	number: string | null;
}

export interface TypedTeam {
	name: string;
	players: TypedPlayer[];
}

/** Bullets, dashes and the like that people put in front of list items. */
const LEADING_DECORATION = /^[\s\-–—•*·>]+/;

/** A shirt number followed by a name: "10 Luis", "#7 - Ana", "1. Pedro". */
const NUMBER_THEN_NAME = /^#?(\d{1,3})\s*[.)\-–:]?\s+(\S.*)$/;

function tidy(text: string): string {
	return text.replace(LEADING_DECORATION, '').replace(/\s+/g, ' ').trim();
}

/** One player from a piece of text, or null when there is no name in it. */
export function parsePlayer(text: string): TypedPlayer | null {
	const line = tidy(text);
	if (!line) return null;
	const numbered = NUMBER_THEN_NAME.exec(line);
	if (numbered) return { number: numbered[1], name: numbered[2].trim() };
	// A bare number is not a name.
	if (/^#?\d+$/.test(line)) return null;
	return { number: null, name: line };
}

/** Players separated by line breaks, commas or semicolons. */
export function parsePlayers(text: string): TypedPlayer[] {
	return text
		.split(/[\n,;]+/)
		.map(parsePlayer)
		.filter((player) => player !== null);
}

/**
 * One team per line. Players may follow the name after a colon, separated by commas.
 * Repeated team names keep the first line that used them.
 */
export function parseTeams(text: string): TypedTeam[] {
	const teams = new Map<string, TypedTeam>();
	for (const rawLine of text.split('\n')) {
		const line = tidy(rawLine);
		if (!line) continue;
		const colon = line.indexOf(':');
		const name = (colon === -1 ? line : line.slice(0, colon)).trim();
		if (!name) continue;
		const key = name.toLocaleLowerCase('es');
		if (teams.has(key)) continue;
		teams.set(key, { name, players: colon === -1 ? [] : parsePlayers(line.slice(colon + 1)) });
	}
	return [...teams.values()];
}
