<script lang="ts">
	import { resolve } from '$app/paths';
	import PlannerForm from '#lib/admin/PlannerForm.svelte';
	import { formatDate, plural } from '#lib/league/format.ts';
	import { LEG_LABELS } from '#lib/league/labels.ts';
	import { gamesPerTeamByDay, isScheduleOutdated } from '#lib/league/schedule.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const league = $derived(data.league);
	const teamIds = $derived(league.teams.map((team) => team.id));
	const outdated = $derived(isScheduleOutdated(teamIds, league.tournament.legs, league.matches));
	const gamesByTeam = $derived(
		gamesPerTeamByDay(
			teamIds,
			league.matchDays.map((day) => day.id),
			league.matches
		)
	);
</script>

{#if league.teams.length < 2}
	<div class="notice">
		<p>Para armar el calendario hacen falta al menos 2 equipos.</p>
		<a class="btn btn-sm btn-primary" href={resolve('admin/equipos')}>Ir a equipos</a>
	</div>
{:else if outdated}
	<div class="notice">
		<p>
			Los equipos cambiaron desde que se armó el calendario. Vuelve a generarlo para que todos
			tengan sus partidos.
		</p>
	</div>
{/if}

<div class="stack planner">
	<!-- A fresh form after every save, so it always starts from what is stored. -->
	{#key league.tournament.updatedAt}
		<PlannerForm {league} />
	{/key}

	<section class="panel">
		<div class="panel-head">
			<div>
				<h2 class="panel-title">Calendario actual</h2>
				{#if league.matches.length > 0}
					<p class="help">
						{plural(league.matches.length, 'partido')} · {LEG_LABELS[
							league.tournament.legs
						].toLowerCase()}. La tabla muestra cuántos partidos juega cada equipo en cada jornada.
					</p>
				{/if}
			</div>
			{#if league.matches.length > 0}
				<a class="btn btn-sm" href={resolve('admin/partidos')}>Ver y editar partidos</a>
			{/if}
		</div>

		{#if league.matches.length === 0}
			<div class="empty">
				Todavía no hay calendario. Revisa el formato y pulsa “Generar calendario”.
			</div>
		{:else}
			<div class="table-scroll">
				<table class="data-table">
					<thead>
						<tr>
							<th>Equipo</th>
							{#each league.matchDays as day (day.id)}
								<th class="num" title={formatDate(day.date, 'long')}>
									J{day.number}
									<small>{formatDate(day.date, 'short')}</small>
								</th>
							{/each}
							<th class="num">Total</th>
						</tr>
					</thead>
					<tbody>
						{#each league.teams as team (team.id)}
							{@const games = gamesByTeam.get(team.id) ?? []}
							<tr>
								<td>
									<span class="team">
										<span class="team-dot" style:background={team.color}></span>
										{team.name}
									</span>
								</td>
								{#each games as count, index (index)}
									<td class="num" class:muted={count === 0}>{count}</td>
								{/each}
								<td class="num total">{games.reduce((sum, count) => sum + count, 0)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.notice {
		margin-bottom: 16px;
	}

	th small {
		display: block;
		font-weight: 500;
	}

	.team {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
	}

	.total {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.2rem;
	}
</style>
