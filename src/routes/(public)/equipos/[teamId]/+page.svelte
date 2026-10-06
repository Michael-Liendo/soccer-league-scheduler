<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate, formatTime, plural } from '#lib/league/format.ts';
	import { CARD_PLURALS, POSITION_LABELS } from '#lib/league/labels.ts';
	import { computePlayerStats, computeStandings } from '#lib/league/standings.ts';
	import { CARD_COUNTERS, type Match } from '#lib/league/types.ts';
	import { cardsOnRecord, sortedPlayers, teamsById } from '#lib/league/view.ts';
	import FormChips from '#lib/ui/FormChips.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const league = $derived(data.league);
	const teams = $derived(teamsById(league.teams));
	const team = $derived(teams.get(data.teamId));
	const table = $derived(computeStandings(league.teams, league.matches, league.tournament));
	const position = $derived(table.findIndex((row) => row.teamId === data.teamId) + 1);
	const record = $derived(table[position - 1]);
	const dayNumbers = $derived(new Map(league.matchDays.map((day) => [day.id, day])));
	const fixtures = $derived(
		league.matches.filter(
			(match) => match.homeTeamId === data.teamId || match.awayTeamId === data.teamId
		)
	);
	const playerStats = $derived(
		new Map(
			computePlayerStats(league.teams, league.matches)
				.filter((stat) => stat.playerId !== null)
				.map((stat) => [stat.playerId, stat])
		)
	);

	const cards = $derived(cardsOnRecord(league));

	const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

	function outcome(match: Match): { label: string; kind: 'W' | 'D' | 'L' | 'live' } | null {
		if (match.status === 'pending') return null;
		const isHome = match.homeTeamId === data.teamId;
		const scored = isHome ? match.homeScore : match.awayScore;
		const conceded = isHome ? match.awayScore : match.homeScore;
		const label = `${scored}–${conceded}`;
		if (match.status === 'live') return { label: `${label} en vivo`, kind: 'live' };
		return { label, kind: scored > conceded ? 'W' : scored < conceded ? 'L' : 'D' };
	}
</script>

<svelte:head>
	{#if team}<title>{team.name} · {league.tournament.name}</title>{/if}
</svelte:head>

<a class="back" href={resolve('equipos')}>← Todos los equipos</a>

{#if !team || !record}
	<div class="empty">Ese equipo ya no está en la copa.</div>
{:else}
	<section class="panel sheet" style:--team-color={team.color}>
		<header>
			<h2 class="panel-title">{team.name}</h2>
			<p class="muted">
				{position}.º en la tabla con {plural(record.points, 'punto')}
			</p>
		</header>

		<dl class="record">
			<div>
				<dt>Pos.</dt>
				<dd>{position}.º</dd>
			</div>
			<div>
				<dt>PTS</dt>
				<dd>{record.points}</dd>
			</div>
			<div>
				<dt>PJ</dt>
				<dd>{record.played}</dd>
			</div>
			<div>
				<dt>G</dt>
				<dd>{record.won}</dd>
			</div>
			<div>
				<dt>E</dt>
				<dd>{record.drawn}</dd>
			</div>
			<div>
				<dt>P</dt>
				<dd>{record.lost}</dd>
			</div>
			<div>
				<dt>DG</dt>
				<dd>{signed(record.goalDifference)}</dd>
			</div>
		</dl>

		{#if record.form.length > 0}
			<p class="recent">
				<span class="field-label">Últimos resultados</span>
				<FormChips form={record.form} />
			</p>
		{/if}
	</section>

	<div class="two-columns columns">
		<section class="panel">
			<h3 class="section-title">Partidos</h3>
			{#if fixtures.length === 0}
				<p class="help">Sin partidos en el calendario.</p>
			{:else}
				<ul class="fixtures">
					{#each fixtures as match (match.id)}
						{@const isHome = match.homeTeamId === data.teamId}
						{@const rival = teams.get(isHome ? match.awayTeamId : match.homeTeamId)}
						{@const day = dayNumbers.get(match.matchDayId)}
						{@const result = outcome(match)}
						<li>
							<span class="day" title={day ? formatDate(day.date, 'long') : undefined}>
								J{day?.number ?? '–'}
							</span>
							<span class="rival">
								<span class="team-dot" style:background={rival?.color}></span>
								{rival?.name ?? 'Por definir'}
							</span>
							{#if result}
								<span class={['result', result.kind]}>{result.label}</span>
							{:else}
								<span class="muted when">
									{day ? formatDate(day.date, 'short') : ''}{match.time
										? `, ${formatTime(match.time)}`
										: ''}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="panel">
			<h3 class="section-title">Plantilla</h3>
			{#if team.players.length === 0}
				<p class="help">Plantilla sin cargar.</p>
			{:else}
				<div class="table-scroll">
					<table class="data-table">
						<thead>
							<tr>
								<th>Jugador</th>
								<th class="num">Goles</th>
								{#each cards as card (card)}
									<th class="num">
										<span class={['card', card]} title={CARD_PLURALS[card]}></span>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each sortedPlayers(team) as player (player.id)}
								{@const stat = playerStats.get(player.id)}
								<tr>
									<td>
										<span class="player">
											{#if player.number}<span class="shirt">{player.number}</span>{/if}
											<span>
												{player.name}
												{#if player.position}
													<small class="muted">{POSITION_LABELS[player.position]}</small>
												{/if}
											</span>
										</span>
									</td>
									<td class="num">{stat?.goals || '–'}</td>
									{#each cards as card (card)}
										<td class="num">{stat?.[CARD_COUNTERS[card]] || '–'}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	</div>
{/if}

<style>
	.back {
		display: inline-block;
		margin-bottom: 12px;
		color: var(--color-text-muted);
		font-weight: 600;
		text-decoration: none;
	}

	.back:hover {
		color: var(--color-text);
	}

	.sheet {
		display: flex;
		flex-direction: column;
		gap: 14px;
		border-top: 6px solid var(--team-color);
	}

	.record {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		margin: 0;
		padding: 10px 4px;
		border-radius: 12px;
		background: var(--color-bg);
		text-align: center;
	}

	.record dt {
		color: var(--color-text-muted);
		font-size: 0.76rem;
	}

	.record dd {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.35rem;
	}

	.recent {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.columns {
		margin-top: 16px;
	}

	.section-title {
		margin-bottom: 8px;
	}

	.fixtures {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.fixtures li {
		display: grid;
		grid-template-columns: 40px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.93rem;
	}

	.fixtures li:last-child {
		border-bottom: 0;
	}

	.day {
		color: var(--color-text-muted);
		font-family: var(--font-display);
		font-weight: 700;
	}

	.rival {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		font-weight: 600;
	}

	.when {
		font-size: 0.86rem;
		white-space: nowrap;
	}

	.result {
		padding: 2px 9px;
		border-radius: 6px;
		color: #fff;
		font-family: var(--font-display);
		font-weight: 700;
		white-space: nowrap;
	}

	.result.W {
		background: var(--color-win);
	}

	.result.D {
		background: var(--color-draw);
	}

	.result.L {
		background: var(--color-loss);
	}

	.result.live {
		background: var(--color-live);
	}

	.player {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.player small {
		margin-left: 4px;
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

	.card.blue {
		background: var(--color-blue-card);
	}

	.card.red {
		background: var(--color-red-card);
	}

	@media (max-width: 480px) {
		.record {
			grid-template-columns: repeat(4, 1fr);
			row-gap: 10px;
		}
	}
</style>
