<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import TeamEditor from '#lib/admin/TeamEditor.svelte';
	import { plural } from '#lib/league/format.ts';
	import { nextTeamColor } from '#lib/league/labels.ts';
	import { isScheduleOutdated } from '#lib/league/schedule.ts';
	import { LIMITS } from '#lib/league/types.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let creating = $state(false);

	const league = $derived(data.league);
	const suggestedColor = $derived(nextTeamColor(league.teams.map((team) => team.color)));
	const calendarOutdated = $derived(
		isScheduleOutdated(
			league.teams.map((team) => team.id),
			league.tournament.legs,
			league.matches
		)
	);
</script>

<section class="panel">
	<div class="panel-head">
		<div>
			<h2 class="panel-title">Equipos y plantillas</h2>
			<p class="help">
				{plural(league.teams.length, 'equipo')} · se juega {league.tournament.playersOnField} contra
				{league.tournament.playersOnField}, así que cada plantilla necesita al menos
				{league.tournament.playersOnField} jugadores.
			</p>
		</div>
		<button
			type="button"
			class="btn btn-primary"
			disabled={league.teams.length >= LIMITS.maxTeams}
			onclick={() => (creating = true)}
		>
			<Icon name="plus" /> Añadir equipo
		</button>
	</div>
	{#if calendarOutdated}
		<div class="notice">
			<p>
				Los equipos cambiaron desde que se armó el calendario. Vuelve a generarlo para que todos
				tengan sus partidos.
			</p>
			<a class="btn btn-sm btn-primary" href={resolve('admin/calendario')}>Ir al calendario</a>
		</div>
	{:else if league.teams.length >= 2 && league.matches.length === 0}
		<div class="notice">
			<p>Cuando estén todos los equipos, arma el calendario de las jornadas.</p>
			<a class="btn btn-sm btn-primary" href={resolve('admin/calendario')}>Armar calendario</a>
		</div>
	{/if}
</section>

{#if league.teams.length === 0}
	<div class="empty first">
		Todavía no hay equipos. Añade el primero para empezar a armar la copa.
	</div>
{:else}
	<div class="two-columns list">
		{#each league.teams as team (team.id)}
			<TeamEditor {team} playersOnField={league.tournament.playersOnField} />
		{/each}
	</div>
{/if}

<Dialog bind:open={creating} title="Añadir equipo">
	<form
		id="create-team"
		class="stack"
		method="POST"
		action="?/createTeam"
		use:enhance={withFeedback({ reset: true, onSuccess: () => (creating = false) })}
	>
		<label class="field">
			<span class="field-label">Nombre del equipo</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="input"
				name="name"
				maxlength={LIMITS.teamName}
				required
				autofocus
				placeholder="Ej. Deportivo Playa Los Ángeles"
			/>
		</label>
		<label class="field">
			<span class="field-label">Color</span>
			<input type="color" name="color" value={suggestedColor} />
		</label>
		<p class="help">Después podrás cargar los jugadores en la tarjeta del equipo.</p>
	</form>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (creating = false)}>Cancelar</button>
		<button class="btn btn-primary" form="create-team">Crear equipo</button>
	{/snippet}
</Dialog>

<style>
	.list,
	.first {
		margin-top: 16px;
	}

	.panel-head:last-child {
		margin-bottom: 0;
	}
</style>
