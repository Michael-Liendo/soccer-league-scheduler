<script lang="ts">
	import type { Snippet } from 'svelte';
	import { capitalize, formatDate, formatTime, plural } from '#lib/league/format.ts';
	import type { League, Match } from '#lib/league/types.ts';
	import { kickoffRange, scheduleByDay, teamsById, venueOf } from '#lib/league/view.ts';
	import MatchCard from './MatchCard.svelte';

	interface Props {
		league: League;
		today: string;
		/** Extra buttons for each match, used by the admin panel. */
		actions?: Snippet<[Match]>;
	}

	let { league, today, actions }: Props = $props();

	let dayFilter = $state('all');
	let teamFilter = $state('all');

	const teams = $derived(teamsById(league.teams));
	const days = $derived(
		scheduleByDay(league)
			.filter(({ day }) => dayFilter === 'all' || String(day.id) === dayFilter)
			.map(({ day, matches }) => ({
				day,
				total: matches.length,
				finished: matches.filter((match) => match.status === 'finished').length,
				range: kickoffRange(matches),
				matches: matches.filter(
					(match) =>
						teamFilter === 'all' ||
						String(match.homeTeamId) === teamFilter ||
						String(match.awayTeamId) === teamFilter
				)
			}))
			.filter(({ matches }) => matches.length > 0)
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

{#each days as { day, total, finished, range, matches } (day.id)}
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
					actions={actions ? matchActions : undefined}
				/>
				{#snippet matchActions()}
					{@render actions?.(match)}
				{/snippet}
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
