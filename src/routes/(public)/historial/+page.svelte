<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate } from '#lib/league/format.ts';
	import { STAGE_LABELS } from '#lib/league/labels.ts';
	import { withFeedback } from '#lib/ui/forms.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Historial · {data.league.tournament.name}</title>
</svelte:head>

{#if data.archives.length === 0}
	<div class="empty">Todavía no hay torneos terminados.</div>
{:else}
	<div class="stack">
		{#each data.archives as archive (archive.id)}
			<section class="panel">
				<div class="panel-head">
					<div>
						<h2 class="panel-title">{archive.title}</h2>
						{#if archive.from}
							<p class="help">
								{formatDate(archive.from, 'long')}{archive.to && archive.to !== archive.from
									? ` al ${formatDate(archive.to, 'long')}`
									: ''}
							</p>
						{/if}
					</div>
					{#if data.isOwner}
						<form method="POST" action="?/remove" use:enhance={withFeedback()}>
							<input type="hidden" name="id" value={archive.id} />
							<button
								class="btn btn-sm btn-danger"
								onclick={(event) => {
									if (!confirm('¿Quitar este torneo del historial?')) event.preventDefault();
								}}
							>
								Quitar
							</button>
						</form>
					{/if}
				</div>

				{#if archive.champion}
					<p class="champion">🏆 Campeón: <strong>{archive.champion}</strong></p>
				{/if}
				{#if archive.runnerUp || archive.third}
					<p class="help">
						{#if archive.runnerUp}Subcampeón: {archive.runnerUp}{/if}
						{#if archive.third}· Tercero: {archive.third}{/if}
					</p>
				{/if}

				<div class="table-scroll">
					<table class="data-table">
						<thead>
							<tr>
								<th>#</th>
								<th>Equipo</th>
								<th class="num">PTS</th>
								<th class="num">PJ</th>
								<th class="num">G</th>
								<th class="num">E</th>
								<th class="num">P</th>
								<th class="num">DG</th>
							</tr>
						</thead>
						<tbody>
							{#each archive.table as row, index (index)}
								<tr>
									<td>{index + 1}</td>
									<td>{row.team}</td>
									<td class="num"><strong>{row.points}</strong></td>
									<td class="num">{row.played}</td>
									<td class="num">{row.won}</td>
									<td class="num">{row.drawn}</td>
									<td class="num">{row.lost}</td>
									<td class="num">{row.goalsFor - row.goalsAgainst}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if archive.scorers.length > 0}
					<h3 class="section-title">Goleadores</h3>
					<ol class="list">
						{#each archive.scorers.slice(0, 5) as scorer, index (index)}
							<li>{scorer.name} <span class="muted">({scorer.team})</span>: {scorer.goals}</li>
						{/each}
					</ol>
				{/if}

				{#if archive.results.length > 0}
					<details>
						<summary>Resultados ({archive.results.length} partidos)</summary>
						<ul class="list">
							{#each archive.results as result, index (index)}
								<li>
									{#if result.stage !== 'league'}<strong>{STAGE_LABELS[result.stage]}:</strong>{/if}
									{result.home}
									{result.homeScore}–{result.awayScore}
									{result.away}
									{#if result.walkover}<span class="muted">(W.O.)</span>{/if}
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			</section>
		{/each}
	</div>
{/if}

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.champion {
		font-size: 1.1rem;
	}

	.list {
		margin: 0;
		padding-left: 1.4em;
	}

	details summary {
		color: var(--color-text-muted);
		font-weight: 600;
		cursor: pointer;
	}
</style>
