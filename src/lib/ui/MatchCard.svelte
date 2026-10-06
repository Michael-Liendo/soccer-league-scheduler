<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatTime } from '#lib/league/format.ts';
	import { STATUS_LABELS } from '#lib/league/labels.ts';
	import type { Match, Team } from '#lib/league/types.ts';

	interface Props {
		match: Match;
		home: Team | undefined;
		away: Team | undefined;
		venue: string;
		actions?: Snippet;
	}

	let { match, home, away, venue, actions }: Props = $props();

	const isPending = $derived(match.status === 'pending');
</script>

<article class="match" class:live={match.status === 'live'}>
	<div class="meta">
		<div class="when">
			<span class="time">{match.time ? formatTime(match.time) : 'Sin hora'}</span>
			{#if venue}<span>{venue}</span>{/if}
		</div>
		<span
			class="badge"
			class:badge-live={match.status === 'live'}
			class:badge-outline={match.status === 'finished'}
		>
			{STATUS_LABELS[match.status]}
		</span>
	</div>

	<div class="teams">
		<div class="side home">
			<span class="name" class:unknown={!home}>{home?.name ?? 'Por definir'}</span>
			{#if home}<span class="team-dot" style:background={home.color}></span>{/if}
		</div>
		{#if isPending}
			<div class="board versus">vs</div>
		{:else}
			<div class="board">
				{match.homeScore}<span class="dash">–</span>{match.awayScore}
			</div>
		{/if}
		<div class="side">
			{#if away}<span class="team-dot" style:background={away.color}></span>{/if}
			<span class="name" class:unknown={!away}>{away?.name ?? 'Por definir'}</span>
		</div>
	</div>

	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
</article>

<style>
	.match {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		padding: 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-l);
		background: var(--color-surface);
	}

	.match.live {
		border-color: var(--color-live);
		box-shadow: inset 0 3px 0 var(--color-live);
	}

	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--color-text-muted);
		font-size: 0.86rem;
	}

	.when {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
	}

	.time {
		color: var(--color-text);
		font-weight: 600;
	}

	.badge-live {
		background: var(--color-live);
		color: #fff;
	}

	.teams {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 10px;
	}

	.side {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		font-weight: 600;
		line-height: 1.2;
	}

	.side.home {
		justify-content: flex-end;
		text-align: right;
	}

	.name {
		display: -webkit-box;
		overflow: hidden;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.name.unknown {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.board {
		min-width: 90px;
		padding: 8px 12px;
		border-radius: var(--radius-s);
		background: var(--color-board);
		color: var(--color-on-board);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 2rem;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		text-align: center;
		white-space: nowrap;
	}

	.board.versus {
		padding: 12px;
		font-weight: 700;
		font-size: 1.15rem;
		opacity: 0.92;
	}

	.dash {
		margin: 0 7px;
		opacity: 0.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
		padding-top: 10px;
		border-top: 1px solid var(--color-border);
	}

	@media (max-width: 600px) {
		.match {
			padding: 12px;
		}

		.teams {
			gap: 8px;
		}

		.board {
			min-width: 76px;
			padding: 8px;
			font-size: 1.7rem;
		}

		.board.versus {
			min-width: 46px;
			padding: 10px 8px;
			font-size: 1rem;
		}
	}
</style>
