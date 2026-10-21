<script lang="ts">
	import type { Snippet } from 'svelte';
	import { capitalize, formatDate, formatTime, plural } from '#lib/league/format.ts';
	import { plannedKnockouts, type PlannedKnockout } from '#lib/league/playoffs.ts';
	import type { League, Match } from '#lib/league/types.ts';
	import {
		kickoffRange,
		nowAndNext,
		orderOfPlay,
		scheduleByDay,
		teamsById,
		venueOf
	} from '#lib/league/view.ts';
	import MatchCard from './MatchCard.svelte';

	interface Props {
		league: League;
		today: string;
		/** Current time in epoch milliseconds, ticking, for the clocks of matches in play. */
		now?: number;
		/** Extra buttons shown under each match. */
		actions?: Snippet<[Match]>;
		/** Which matches get the extra buttons. All of them unless told otherwise. */
		hasActions?: (match: Match) => boolean;
	}

	let { league, today, now, actions, hasActions = () => true }: Props = $props();

	const order = $derived(orderOfPlay(league));
	const next = $derived(nowAndNext(league).next);

	/** On a match day the list opens on that day's matches; otherwise it shows them all. */
	function initialDayFilter(): string {
		const playingToday = league.matchDays.find((day) => day.date === today);
		const hasMatches = league.matches.some((match) => match.matchDayId === playingToday?.id);
		return playingToday && hasMatches ? String(playingToday.id) : 'all';
	}

	let dayFilter = $state(initialDayFilter());
	let teamFilter = $state('all');

	const teams = $derived(teamsById(league.teams));
	const planned = $derived(plannedKnockouts(league));

	/** A stand-in for a knockout match not set up yet, so it shows like the others. */
	function placeholder(knockout: PlannedKnockout): Match {
		return {
			id: 0,
			matchDayId: knockout.matchDayId,
			round: 0,
			leg: 1,
			slot: 0,
			time: knockout.time,
			venue: null,
			homeTeamId: 0,
			awayTeamId: 0,
			status: 'pending',
			homeScore: 0,
			awayScore: 0,
			clockStartedAt: null,
			clockElapsedMs: 0,
			forfeitedBy: null,
			stage: knockout.stage,
			events: []
		};
	}
	const days = $derived(
		scheduleByDay(league)
			.filter(({ day }) => dayFilter === 'all' || String(day.id) === dayFilter)
			.map(({ day, matches }) => ({
				day,
				total: matches.length,
				knockouts: teamFilter === 'all' ? planned.filter((k) => k.matchDayId === day.id) : [],
				finished: matches.filter((match) => match.status === 'finished').length,
				range: kickoffRange(matches),
				matches: matches.filter(
					(match) =>
						teamFilter === 'all' ||
						String(match.homeTeamId) === teamFilter ||
						String(match.awayTeamId) === teamFilter
				)
			}))
			.filter(({ matches, knockouts }) => matches.length > 0 || knockouts.length > 0)
	);
</script>

<div class="filters">
	<label class="filter">
		Jornada
		<select class="input" bind:value={dayFilter}>
			<option value="all">Todas</option>
			{#each league.matchDays as day (day.id)}
				<option value={String(day.id)}>
					Jornada {day.number} · {formatDate(day.date, 'medium')}
				</option>
			{/each}
		</select>
	</label>
	<label class="filter">
		Equipo
		<select class="input" bind:value={teamFilter}>
			<option value="all">Todos</option>
			{#each league.teams as team (team.id)}
				<option value={String(team.id)}>{team.name}</option>
			{/each}
		</select>
	</label>
</div>

{#each days as { day, total, finished, range, matches, knockouts } (day.id)}
	<section class="day">
		<header class="day-head">
			<h2>
				Jornada {day.number}
				{#if day.date === today}<span class="badge badge-accent">Hoy</span>{/if}
			</h2>
			<p class="muted">
				{capitalize(formatDate(day.date, 'long'))}
				{#if range}· desde las {formatTime(range.first)}{/if}
				· {finished > 0 ? `${finished} de ${total} jugados` : plural(total, 'partido')}
			</p>
		</header>
		<div class="grid">
			{#each matches as match (match.id)}
				<MatchCard
					{match}
					home={teams.get(match.homeTeamId)}
					away={teams.get(match.awayTeamId)}
					venue={venueOf(match, league)}
					order={order.get(match.id)}
					isNext={match.id === next?.id}
					{now}
					actions={actions && hasActions(match) ? matchActions : undefined}
				/>
				{#snippet matchActions()}
					{@render actions?.(match)}
				{/snippet}
			{/each}
			{#each knockouts as knockout, index (knockout.key)}
				{@const match = placeholder(knockout)}
				<MatchCard
					{match}
					home={undefined}
					away={undefined}
					homeLabel={knockout.home}
					awayLabel={knockout.away}
					venue={venueOf(match, league)}
					order={total + index + 1}
				/>
			{/each}
		</div>
	</section>
{:else}
	<div class="empty">No hay partidos con esos filtros.</div>
{/each}

<style>
	.filters {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 240px));
		gap: 10px;
		margin-bottom: 6px;
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		color: var(--color-text-muted);
		font-size: 0.84rem;
	}

	@media (max-width: 600px) {
		.filters {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.day-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 12px;
		margin: 22px 0 10px;
	}

	.day-head h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.4rem;
	}

	.day-head p {
		font-size: 0.85rem;
		font-weight: 500;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr));
		gap: 12px;
	}
</style>
