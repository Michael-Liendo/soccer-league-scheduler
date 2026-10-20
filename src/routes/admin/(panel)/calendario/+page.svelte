<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import PlannerForm from '#lib/admin/PlannerForm.svelte';
	import { PLAYOFF_DESCRIPTIONS, PLAYOFF_LABELS, STAGE_LABELS } from '#lib/league/labels.ts';
	import { nextPlayoffRound } from '#lib/league/playoffs.ts';
	import { PLAYOFF_FORMATS } from '#lib/league/types.ts';
	import { submitOnChange, withFeedback } from '#lib/ui/forms.ts';
	import { formatDate, plural } from '#lib/league/format.ts';
	import { LEG_LABELS } from '#lib/league/labels.ts';
	import { gamesPerTeamByDay, isScheduleOutdated } from '#lib/league/schedule.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const league = $derived(data.league);
	const teamIds = $derived(league.teams.map((team) => team.id));
	const outdated = $derived(isScheduleOutdated(teamIds, league.tournament.legs, league.matches));
	const knockoutMatches = $derived(league.matches.filter((match) => match.stage !== 'league'));
	const nextStep = $derived(nextPlayoffRound(league));
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
	{#if data.isOwner}
		{#key league.tournament.updatedAt}
			<PlannerForm {league} />
		{/key}
	{:else}
		<div class="notice">
			<p>Solo el administrador puede cambiar los días, el horario o rehacer el calendario.</p>
		</div>
	{/if}

	<section class="panel">
		<div class="panel-head">
			<div>
				<h2 class="panel-title">Fase final</h2>
				<p class="help">
					Lo que se juega después de la liga. El mejor ubicado en la tabla juega de local y, si
					empatan, pasa él.
				</p>
			</div>
		</div>
		<form class="formats" method="POST" action="?/savePlayoff" use:enhance={withFeedback()}>
			{#each PLAYOFF_FORMATS as format (format)}
				<label class="format">
					<input
						type="radio"
						name="playoff"
						value={format}
						checked={league.tournament.playoff === format}
						disabled={!data.isOwner || knockoutMatches.length > 0}
						onchange={submitOnChange}
					/>
					<span>
						<strong>{PLAYOFF_LABELS[format]}</strong>
						<span class="help">{PLAYOFF_DESCRIPTIONS[format]}</span>
					</span>
				</label>
			{/each}
		</form>
		{#if league.tournament.playoff !== 'none'}
			<div class="btn-row">
				{#if nextStep && 'round' in nextStep}
					<form method="POST" action="?/createPlayoffRound" use:enhance={withFeedback()}>
						<button class="btn btn-primary">
							Armar {nextStep.round.stage === 'final' ? 'la final' : 'las semifinales'}
						</button>
					</form>
				{:else if nextStep && 'waiting' in nextStep}
					<p class="help">{nextStep.waiting}</p>
				{:else}
					<p class="help">La fase final ya está armada.</p>
				{/if}
				{#if knockoutMatches.length > 0 && data.isOwner}
					<form method="POST" action="?/removePlayoffs" use:enhance={withFeedback()}>
						<button
							class="btn btn-danger"
							onclick={(event) => {
								if (!confirm('¿Borrar las semifinales y la final, con sus resultados?'))
									event.preventDefault();
							}}
						>
							Borrar fase final
						</button>
					</form>
				{/if}
			</div>
			{#if knockoutMatches.length > 0}
				<ul class="knockout">
					{#each knockoutMatches as match (match.id)}
						<li>
							<strong>{STAGE_LABELS[match.stage]}</strong>:
							{league.teams.find((team) => team.id === match.homeTeamId)?.name} vs
							{league.teams.find((team) => team.id === match.awayTeamId)?.name}
							{#if match.status === 'finished'}({match.homeScore}–{match.awayScore}){/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>

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

	.formats {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.format {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		cursor: pointer;
	}

	.format > span {
		display: flex;
		flex-direction: column;
	}

	.knockout {
		margin: 12px 0 0;
		padding-left: 1.2em;
	}

	.total {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.2rem;
	}
</style>
