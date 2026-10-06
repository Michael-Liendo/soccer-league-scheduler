<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MatchEditor from '#lib/admin/MatchEditor.svelte';
	import type { Match } from '#lib/league/types.ts';
	import { teamsById } from '#lib/league/view.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import MatchList from '#lib/ui/MatchList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let editingId = $state<number | null>(null);

	const league = $derived(data.league);
	const teams = $derived(teamsById(league.teams));
	const editing = $derived(league.matches.find((match) => match.id === editingId));
	const editingDay = $derived(league.matchDays.find((day) => day.id === editing?.matchDayId));
	const editingTeams = $derived(
		editing
			? `${teams.get(editing.homeTeamId)?.name ?? '?'} contra ${teams.get(editing.awayTeamId)?.name ?? '?'}`
			: ''
	);
</script>

{#if league.matches.length === 0}
	<div class="empty">
		<p>Todavía no hay calendario.</p>
		<a class="btn btn-primary" href={resolve('admin/calendario')}>Armar calendario</a>
	</div>
{:else}
	<MatchList {league} today={data.today}>
		{#snippet actions(match: Match)}
			<form class="status" method="POST" action="?/status" use:enhance={withFeedback()}>
				<input type="hidden" name="matchId" value={match.id} />
				<button
					class={['btn', 'btn-sm', match.status === 'live' && 'on-live']}
					name="status"
					value={match.status === 'live' ? 'pending' : 'live'}
					aria-pressed={match.status === 'live'}
				>
					En vivo
				</button>
				<button
					class={['btn', 'btn-sm', match.status === 'finished' && 'on']}
					name="status"
					value={match.status === 'finished' ? 'live' : 'finished'}
					aria-pressed={match.status === 'finished'}
				>
					{match.status === 'finished' ? 'Finalizado' : 'Finalizar'}
				</button>
			</form>
			<button type="button" class="btn btn-sm btn-primary" onclick={() => (editingId = match.id)}>
				<Icon name="pencil" /> Editar partido
			</button>
		{/snippet}
	</MatchList>
{/if}

<Dialog
	bind:open={() => editing !== undefined, (open) => !open && (editingId = null)}
	title={editingDay ? `Jornada ${editingDay.number}` : 'Partido'}
	subtitle={editingTeams}
	wide
>
	{#if editing}
		<MatchEditor match={editing} {league} />
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

	.status {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-right: auto;
	}

	.status :global(.on) {
		border-color: var(--color-text);
		background: var(--color-text);
		color: var(--color-bg);
	}

	.status :global(.on-live) {
		border-color: var(--color-live);
		background: var(--color-live);
		color: #fff;
	}
</style>
