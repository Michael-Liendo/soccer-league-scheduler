<script lang="ts">
	import { resolve } from '$app/paths';
	import { plural } from '#lib/league/format.ts';
	import { POSITION_LABELS } from '#lib/league/labels.ts';
	import { sortedPlayers } from '#lib/league/view.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data.league.teams.length === 0}
	<div class="empty">Todavía no hay equipos inscritos.</div>
{:else}
	<div class="two-columns">
		{#each data.league.teams as team (team.id)}
			<section class="panel team" style:--team-color={team.color}>
				<header class="team-head">
					<div>
						<h2 class="panel-title">{team.name}</h2>
						<span class="muted">{plural(team.players.length, 'jugador', 'jugadores')}</span>
					</div>
					<a
						class="btn btn-sm"
						href={resolve('/(public)/equipos/[teamId]', { teamId: String(team.id) })}
					>
						Ver ficha
					</a>
				</header>
				{#if team.players.length === 0}
					<p class="help">Plantilla sin cargar.</p>
				{:else}
					<ul class="roster">
						{#each sortedPlayers(team) as player (player.id)}
							<li>
								{#if player.number}<span class="shirt">{player.number}</span>{/if}
								<span>{player.name}</span>
								{#if player.position}
									<small class="muted">{POSITION_LABELS[player.position]}</small>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	</div>
{/if}

<style>
	.team {
		border-top: 5px solid var(--team-color);
	}

	.team-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}

	.roster {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.roster li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.roster li:last-child {
		border-bottom: 0;
	}
</style>
