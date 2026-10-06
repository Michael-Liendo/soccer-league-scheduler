<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatDate } from '#lib/league/format.ts';
	import { LIMITS, type Match } from '#lib/league/types.ts';
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
	const editingTitle = $derived(
		editing
			? `${teams.get(editing.homeTeamId)?.name ?? '?'} vs ${teams.get(editing.awayTeamId)?.name ?? '?'}`
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
			<button type="button" class="btn btn-sm" onclick={() => (editingId = match.id)}>
				<Icon name="pencil" /> Cambiar día u hora
			</button>
		{/snippet}
	</MatchList>
{/if}

<Dialog
	bind:open={() => editing !== undefined, (open) => !open && (editingId = null)}
	title="Cambiar día u hora"
	subtitle={editingTitle}
>
	{#if editing}
		<form
			id="reschedule"
			class="stack"
			method="POST"
			action="?/reschedule"
			use:enhance={withFeedback({ onSuccess: () => (editingId = null) })}
		>
			<input type="hidden" name="matchId" value={editing.id} />
			<label class="field">
				<span class="field-label">Jornada</span>
				<select class="input" name="matchDayId" value={editing.matchDayId}>
					{#each league.matchDays as day (day.id)}
						<option value={day.id}>
							Jornada {day.number} · {formatDate(day.date, 'long')}
						</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span class="field-label">Hora</span>
				<input class="input" type="time" name="time" value={editing.time ?? ''} />
			</label>
			<label class="field">
				<span class="field-label">Cancha</span>
				<input
					class="input"
					name="venue"
					value={editing.venue ?? ''}
					maxlength={LIMITS.venue}
					placeholder={league.tournament.venue || 'Ej. Cancha del malecón'}
				/>
				<span class="help">Déjalo vacío para usar la cancha de la copa.</span>
			</label>
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (editingId = null)}>Cancelar</button>
		<button class="btn btn-primary" form="reschedule">Guardar</button>
	{/snippet}
</Dialog>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
</style>
