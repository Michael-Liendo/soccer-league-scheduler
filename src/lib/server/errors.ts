/**
 * A request the league cannot accept, such as a duplicate team name. The message is written for
 * the person using the admin panel and is safe to show as is.
 */
export class LeagueError extends Error {
	override name = 'LeagueError';
}
