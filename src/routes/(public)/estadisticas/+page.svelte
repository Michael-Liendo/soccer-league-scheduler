<script lang="ts">
	import { resolve } from '$app/paths';
	import { POSITION_LABELS } from '#lib/league/labels.ts';
	import {
		cardedPlayers,
		computePlayerStats,
		defenseTable,
		fairPlayTable,
		topScorers,
		type PlayerStat
	} from '#lib/league/standings.ts';
	import { teamsById } from '#lib/league/view.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const league = $derived(data.league);
	const teams = $derived(teamsById(league.teams));
	const stats = $derived(computePlayerStats(league.teams, league.matches));
	const scorers = $derived(topScorers(stats));
	const carded = $derived(cardedPlayers(stats));
	const defences = $derived(defenseTable(league.teams, league.matches));
	const fairPlay = $derived(fairPlayTable(league.teams, league.matches));

	const average = (value: number) => value.toFixed(1).replace('.', ',');
</script>

{#snippet playerCell(stat: PlayerStat)}
	<span class="player">
		{#if stat.number}<span class="shirt">{stat.number}</span>{/if}
		<span>
			{stat.name}
			{#if stat.position}<small class="muted">{POSITION_LABELS[stat.position]}</small>{/if}
		</span>
	</span>
{/snippet}

{#snippet teamCell(teamId: number)}
	{@const team = teams.get(teamId)}
	<a class="team" href={resolve('/(public)/equipos/[teamId]', { teamId: String(teamId) })}>
		<span class="team-dot" style:background={team?.color}></span>
		<span>{team?.name}</span>
	</a>
{/snippet}

<div class="two-columns">
	<section class="panel">
		<div class="panel-head"><h2 class="panel-title">Goleadores</h2></div>
		<div class="table-scroll">
			<table class="data-table">
				<thead>
					<tr>
						<th>#</th>
						<th>Jugador</th>
						<th>Equipo</th>
						<th class="num">Goles</th>
					</tr>
				</thead>
				<tbody>
					{#each scorers as stat, index (stat.key)}
						<tr>
							<td class="rank">{index + 1}</td>
							<td>{@render playerCell(stat)}</td>
							<td class="muted">{teams.get(stat.teamId)?.name}</td>
							<td class="num big">{stat.goals}</td>
						</tr>
					{:else}
						<tr><td colspan="4" class="none">Todavía no hay goles anotados.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="panel">
		<div class="panel-head"><h2 class="panel-title">Tarjetas</h2></div>
		<div class="table-scroll">
			<table class="data-table">
				<thead>
					<tr>
						<th>Jugador</th>
						<th>Equipo</th>
						<th class="num"><span class="card yellow" title="Amarillas"></span></th>
						<th class="num"><span class="card red" title="Rojas"></span></th>
					</tr>
				</thead>
				<tbody>
					{#each carded as stat (stat.key)}
						<tr>
							<td>{@render playerCell(stat)}</td>
							<td class="muted">{teams.get(stat.teamId)?.name}</td>
							<td class="num">{stat.yellows}</td>
							<td class="num">{stat.reds}</td>
						</tr>
					{:else}
						<tr><td colspan="4" class="none">Todavía no hay tarjetas.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="panel">
		<div class="panel-head">
			<div>
				<h2 class="panel-title">Valla menos vencida</h2>
				<p class="help">
					Ordenada por goles recibidos por partido. Invicta: partidos sin recibir goles.
				</p>
			</div>
		</div>
		<div class="table-scroll">
			<table class="data-table">
				<thead>
					<tr>
						<th>#</th>
						<th>Equipo</th>
						<th class="num" title="Partidos jugados">PJ</th>
						<th class="num" title="Goles en contra">GC</th>
						<th class="num" title="Promedio por partido">Prom.</th>
						<th class="num">Invicta</th>
					</tr>
				</thead>
				<tbody>
					{#each defences as row, index (row.teamId)}
						<tr>
							<td class="rank">{index + 1}</td>
							<td>{@render teamCell(row.teamId)}</td>
							<td class="num">{row.played}</td>
							<td class="num big">{row.goalsAgainst}</td>
							<td class="num">{average(row.goalsAgainstPerMatch)}</td>
							<td class="num">{row.cleanSheets}</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="none">Aparece cuando haya partidos finalizados.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="panel">
		<div class="panel-head">
			<div>
				<h2 class="panel-title">Juego limpio</h2>
				<p class="help">La amarilla suma 1 punto y la roja 3. Gana quien tenga menos.</p>
			</div>
		</div>
		<div class="table-scroll">
			<table class="data-table">
				<thead>
					<tr>
						<th>#</th>
						<th>Equipo</th>
						<th class="num"><span class="card yellow" title="Amarillas"></span></th>
						<th class="num"><span class="card red" title="Rojas"></span></th>
						<th class="num">Pts</th>
					</tr>
				</thead>
				<tbody>
					{#each fairPlay as row, index (row.teamId)}
						<tr>
							<td class="rank">{index + 1}</td>
							<td>{@render teamCell(row.teamId)}</td>
							<td class="num">{row.yellows}</td>
							<td class="num">{row.reds}</td>
							<td class="num big">{row.points}</td>
						</tr>
					{:else}
						<tr><td colspan="5" class="none">Todavía no hay equipos.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

<style>
	.player,
	.team {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.player small {
		margin-left: 4px;
	}

	.team {
		font-weight: 600;
		text-decoration: none;
	}

	.team:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.rank {
		width: 34px;
		color: var(--color-text-muted);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.1rem;
	}

	.big {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.3rem;
	}

	.none {
		padding: 18px;
		color: var(--color-text-muted);
		text-align: center;
	}

	.card {
		display: inline-block;
		width: 9px;
		height: 12px;
		border-radius: 2px;
	}

	.card.yellow {
		background: var(--color-yellow-card);
	}

	.card.red {
		background: var(--color-red-card);
	}
</style>
