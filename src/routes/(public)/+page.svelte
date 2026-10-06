<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { plural } from '#lib/league/format.ts';
	import {
		champion,
		computePlayerStats,
		computeStandings,
		topScorers
	} from '#lib/league/standings.ts';
	import { teamsById } from '#lib/league/view.ts';
	import FormChips from '#lib/ui/FormChips.svelte';
	import ShareDialog from '#lib/ui/ShareDialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let sharing = $state(false);

	const league = $derived(data.league);
	const teams = $derived(teamsById(league.teams));
	const table = $derived(computeStandings(league.teams, league.matches, league.tournament));
	const scorers = $derived(topScorers(computePlayerStats(league.teams, league.matches)));
	const played = $derived(league.matches.filter((match) => match.status === 'finished').length);
	const winner = $derived(champion(league));
	const winnerTeam = $derived(winner ? teams.get(winner.teamId) : undefined);

	const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

	const shareText = $derived(
		[
			`🏆 *${league.tournament.name}*`,
			'Tabla de posiciones',
			'',
			...table.map(
				(row, index) =>
					`${index + 1}. ${teams.get(row.teamId)?.name}: ${plural(row.points, 'pt')} (PJ ${row.played}, DG ${signed(row.goalDifference)})`
			),
			'',
			`${page.url.origin}/`
		].join('\n')
	);
</script>

{#if league.teams.length === 0}
	<div class="empty">Todavía no hay equipos inscritos. Vuelve pronto.</div>
{:else}
	{#if winner && winnerTeam}
		<section class="champion" style:--team-color={winnerTeam.color}>
			<svg class="trophy" viewBox="0 0 96 104" aria-hidden="true">
				<path
					d="M24 14H10v8c0 10 6 16 16 17M72 14h14v8c0 10-6 16-16 17"
					fill="none"
					stroke="currentColor"
					stroke-width="6"
					stroke-linecap="round"
				/>
				<g fill="currentColor">
					<path d="M24 8h48v22c0 15-10 26-24 26S24 45 24 30z" />
					<rect x="43" y="54" width="10" height="18" />
					<path d="M30 72h36l4 12H26z" />
					<rect x="20" y="88" width="56" height="10" rx="3" />
				</g>
			</svg>
			<div>
				<p class="champion-kicker">Campeón de {league.tournament.name}</p>
				<p class="champion-name">{winnerTeam.name}</p>
				<dl class="podium">
					{#if table[1]}
						<div>
							<dt>Subcampeón</dt>
							<dd>{teams.get(table[1].teamId)?.name}</dd>
						</div>
					{/if}
					{#if table[2]}
						<div>
							<dt>Tercer lugar</dt>
							<dd>{teams.get(table[2].teamId)?.name}</dd>
						</div>
					{/if}
					{#if scorers[0]}
						<div>
							<dt>Goleador</dt>
							<dd>{scorers[0].name} ({plural(scorers[0].goals, 'gol', 'goles')})</dd>
						</div>
					{/if}
				</dl>
			</div>
		</section>
	{/if}

	<dl class="facts">
		<div>
			<dt>Líder</dt>
			<dd>{played > 0 ? teams.get(table[0].teamId)?.name : '–'}</dd>
		</div>
		<div>
			<dt>Goleador</dt>
			<dd>{scorers[0] ? `${scorers[0].name} (${scorers[0].goals})` : '–'}</dd>
		</div>
		<div>
			<dt>Partidos jugados</dt>
			<dd>{played} de {league.matches.length}</dd>
		</div>
	</dl>

	<section class="panel">
		<div class="panel-head">
			<h2 class="panel-title">Tabla de posiciones</h2>
			<button type="button" class="btn btn-sm" onclick={() => (sharing = true)}>
				Compartir tabla
			</button>
		</div>
		<div class="table-scroll">
			<table class="standings">
				<thead>
					<tr>
						<th>#</th>
						<th class="team">Equipo</th>
						<th title="Puntos">PTS</th>
						<th title="Partidos jugados">PJ</th>
						<th title="Ganados">G</th>
						<th title="Empatados">E</th>
						<th title="Perdidos">P</th>
						<th class="wide" title="Goles a favor">GF</th>
						<th class="wide" title="Goles en contra">GC</th>
						<th title="Diferencia de goles">DG</th>
						<th class="wide">Últimos 5</th>
					</tr>
				</thead>
				<tbody>
					{#each table as row, index (row.teamId)}
						{@const team = teams.get(row.teamId)}
						<tr class:leader={index === 0 && played > 0}>
							<td class="position">{index + 1}</td>
							<td class="team">
								<a
									class="team-link"
									href={resolve('/(public)/equipos/[teamId]', { teamId: String(row.teamId) })}
								>
									<span class="team-dot" style:background={team?.color}></span>
									<span class="team-name">{team?.name}</span>
								</a>
							</td>
							<td class="points">{row.points}</td>
							<td>{row.played}</td>
							<td>{row.won}</td>
							<td>{row.drawn}</td>
							<td>{row.lost}</td>
							<td class="wide">{row.goalsFor}</td>
							<td class="wide">{row.goalsAgainst}</td>
							<td class:positive={row.goalDifference > 0} class:negative={row.goalDifference < 0}>
								{signed(row.goalDifference)}
							</td>
							<td class="wide"><FormChips form={row.form} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="help legend">
			Victoria {plural(league.tournament.pointsWin, 'punto')}, empate
			{plural(league.tournament.pointsDraw, 'punto')}. Si hay igualdad de puntos decide la
			diferencia de goles, luego los goles a favor y después el juego limpio. Toca un equipo para
			ver su ficha.
		</p>
	</section>
{/if}

{#if scorers.length > 0}
	<section class="panel scorers">
		<div class="panel-head">
			<h2 class="panel-title">Goleadores</h2>
			<a class="btn btn-sm" href={resolve('estadisticas')}>Ver todos</a>
		</div>
		<ol>
			{#each scorers.slice(0, 5) as scorer, index (scorer.key)}
				<li>
					<span class="rank">{index + 1}</span>
					<span class="who">
						<strong>{scorer.name}</strong>
						<span class="muted">{teams.get(scorer.teamId)?.name}</span>
					</span>
					<span class="points">{scorer.goals}</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<ShareDialog bind:open={sharing} title="Compartir tabla" text={shareText} />

<style>
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 1px;
		margin: 0 0 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-l);
		background: var(--color-border);
		overflow: hidden;
	}

	.facts div {
		flex: 1 1 150px;
		padding: 12px 16px;
		background: var(--color-surface);
	}

	.facts dt {
		color: var(--color-text-muted);
		font-size: 0.84rem;
	}

	.facts dd {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.35rem;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}

	.standings {
		width: 100%;
		border-collapse: collapse;
	}

	.standings th {
		padding: 8px 6px;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 0.8rem;
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
	}

	.standings td {
		padding: 9px 6px;
		border-bottom: 1px solid var(--color-border);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.standings tr:last-child td {
		border-bottom: 0;
	}

	.standings .team {
		text-align: left;
	}

	.position {
		position: relative;
		width: 44px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.25rem;
	}

	.leader .position::before {
		content: '';
		position: absolute;
		inset: 7px auto 7px 0;
		width: 4px;
		border-radius: 2px;
		background: var(--color-accent);
	}

	.points {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.35rem;
	}

	.positive {
		color: var(--color-win);
		font-weight: 600;
	}

	.negative {
		color: var(--color-loss);
		font-weight: 600;
	}

	.team-link {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		max-width: 260px;
		padding: 4px 0;
		font-weight: 600;
		text-decoration: none;
	}

	.team-link:hover .team-name {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.team-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.legend {
		margin-top: 12px;
	}

	.scorers {
		margin-top: 16px;
	}

	.scorers ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.scorers li {
		display: grid;
		grid-template-columns: 30px 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.scorers li:last-child {
		border-bottom: 0;
	}

	.rank {
		color: var(--color-text-muted);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.1rem;
	}

	.who {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		min-width: 0;
	}

	.champion {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 10px 22px;
		margin-bottom: 16px;
		padding: 22px 24px;
		border-left: 8px solid var(--team-color);
		border-radius: 16px;
		background: var(--color-board);
		color: var(--color-on-board);
	}

	.trophy {
		width: 84px;
		height: 92px;
		color: var(--color-accent);
		animation: rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.champion-kicker {
		color: var(--color-accent);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
	}

	.champion-name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 6vw, 3.3rem);
		line-height: 0.95;
		overflow-wrap: anywhere;
	}

	.podium {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 22px;
		margin: 12px 0 0;
		font-size: 0.92rem;
	}

	.podium dt {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.podium dd {
		margin: 0;
		font-weight: 600;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.9);
		}
	}

	@media (max-width: 600px) {
		.standings .wide {
			display: none;
		}

		.standings th,
		.standings td {
			padding-inline: 4px;
		}

		.position {
			width: 30px;
		}

		.team-link {
			max-width: none;
		}

		.team-name {
			display: -webkit-box;
			white-space: normal;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}

		.champion {
			grid-template-columns: 1fr;
		}

		.trophy {
			width: 60px;
			height: 66px;
		}
	}
</style>
