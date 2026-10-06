<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MatchEditor from '#lib/admin/MatchEditor.svelte';
	import type { Match } from '#lib/league/types.ts';
	import { nowAndNext, orderOfPlay, teamsById } from '#lib/league/view.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import MatchList from '#lib/ui/MatchList.svelte';
	import { createTicker } from '#lib/ui/ticker.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let editingId = $state<number | null>(null);
	const ticker = createTicker(() => data.now);

	const league = $derived(data.league);
	const teams = $derived(teamsById(league.teams));
	const order = $derived(orderOfPlay(league));
	const upNext = $derived(nowAndNext(league));
	const editing = $derived(league.matches.find((match) => match.id === editingId));
	const editingDay = $derived(league.matchDays.find((day) => day.id === editing?.matchDayId));

	const versus = (match: Match) =>
		`${teams.get(match.homeTeamId)?.name ?? '?'} contra ${teams.get(match.awayTeamId)?.name ?? '?'}`;
</script>

{#if league.matches.length === 0}
	<div class="empty">
		<p>Todavía no hay calendario.</p>
		<a class="btn btn-primary" href={resolve('admin/calendario')}>Armar calendario</a>
	</div>
{:else}
	{#if upNext.live.length > 0 || upNext.next}
		<section class="panel up-next">
			{#each upNext.live as match (match.id)}
				<div class="row">
					<p><span class="badge badge-live">En juego</span> <strong>{versus(match)}</strong></p>
					<button type="button" class="btn btn-primary" onclick={() => (editingId = match.id)}>
						Abrir partido
					</button>
				</div>
			{/each}
			{#if upNext.next}
				{@const next = upNext.next}
				<div class="row">
					<p>
						<span class="badge badge-accent">Sigue</span>
						<strong>{versus(next)}</strong>
						<span class="muted">· Partido {order.get(next.id)}</span>
					</p>
					<button
						type="button"
						class={['btn', upNext.live.length === 0 && 'btn-primary']}
						onclick={() => (editingId = next.id)}
					>
						Abrir para iniciar
					</button>
				</div>
			{/if}
		</section>
	{/if}

	<MatchList {league} today={data.today} now={ticker.now}>
		{#snippet actions(match: Match)}
			<form class="move" method="POST" action="?/move" use:enhance={withFeedback()}>
				<input type="hidden" name="matchId" value={match.id} />
				<button
					class="btn btn-sm"
					name="direction"
					value="earlier"
					aria-label="Jugar antes"
					title="Jugar antes">↑</button
				>
				<button
					class="btn btn-sm"
					name="direction"
					value="later"
					aria-label="Jugar después"
					title="Jugar después">↓</button
				>
			</form>
			<button type="button" class="btn btn-sm btn-primary" onclick={() => (editingId = match.id)}>
				<Icon name="pencil" />
				{match.status === 'pending' ? 'Abrir partido' : 'Editar partido'}
			</button>
		{/snippet}
	</MatchList>
{/if}

<Dialog
	bind:open={() => editing !== undefined, (open) => !open && (editingId = null)}
	title={editingDay && editing
		? `Jornada ${editingDay.number} · Partido ${order.get(editing.id)}`
		: 'Partido'}
	subtitle={editing ? versus(editing) : ''}
	wide
>
	{#if editing}
		{#key editing.id}
			<MatchEditor match={editing} {league} now={ticker.now} canReset={data.isOwner} />
		{/key}
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-primary" onclick={() => (editingId = null)}>Listo</button>
	{/snippet}
</Dialog>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.up-next {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 14px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 14px;
	}

	.up-next :global(.badge-live) {
		background: var(--color-live);
		color: #fff;
	}

	.move {
		display: flex;
		gap: 6px;
		margin-right: auto;
	}
</style>
