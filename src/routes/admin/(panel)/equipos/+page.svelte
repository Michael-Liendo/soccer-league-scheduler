<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import TeamDraw from '#lib/admin/TeamDraw.svelte';
	import TeamEditor from '#lib/admin/TeamEditor.svelte';
	import { plural } from '#lib/league/format.ts';
	import { isScheduleOutdated } from '#lib/league/schedule.ts';
	import { LIMITS } from '#lib/league/types.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let creating = $state(false);
	let drawing = $state(false);

	const league = $derived(data.league);
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
		<div class="btn-row">
			<button
				type="button"
				class="btn"
				disabled={league.teams.length >= LIMITS.maxTeams}
				onclick={() => (drawing = true)}
			>
				<Icon name="shuffle" /> Sortear equipos
			</button>
			<button
				type="button"
				class="btn btn-primary"
				disabled={league.teams.length >= LIMITS.maxTeams}
				onclick={() => (creating = true)}
			>
				<Icon name="plus" /> Añadir equipos
			</button>
		</div>
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
		Todavía no hay equipos. Escríbelos con “Añadir equipos”, o pega la lista de personas en “Sortear
		equipos” y se arman solos.
	</div>
{:else}
	<div class="two-columns list">
		{#each league.teams as team (team.id)}
			<TeamEditor
				{team}
				playersOnField={league.tournament.playersOnField}
				canDelete={data.isOwner}
			/>
		{/each}
	</div>
{/if}

<Dialog bind:open={creating} title="Añadir equipos">
	<form
		id="create-teams"
		class="stack"
		method="POST"
		action="?/createTeams"
		use:enhance={withFeedback({ reset: true, onSuccess: () => (creating = false) })}
	>
		<label class="field">
			<span class="field-label">Un equipo por línea</span>
			<!-- svelte-ignore a11y_autofocus -->
			<textarea class="input" name="teams" rows="7" required autofocus placeholder="Los Tiburones"
			></textarea>
		</label>
		<p class="help">
			Cada equipo recibe un color distinto. Si quieres cargar de una vez los jugadores, escríbelos
			después de dos puntos, separados por comas.
		</p>
	</form>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (creating = false)}>Cancelar</button>
		<button class="btn btn-primary" form="create-teams">Crear equipos</button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={drawing}
	title="Sortear equipos"
	subtitle="Arma los equipos al azar con la lista de personas"
	wide
>
	{#if drawing}
		<TeamDraw
			existingNames={league.teams.map((team) => team.name)}
			ondone={() => (drawing = false)}
		/>
	{/if}
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
