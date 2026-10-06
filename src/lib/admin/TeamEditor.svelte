<script lang="ts">
	import { enhance } from '$app/forms';
	import { plural } from '#lib/league/format.ts';
	import { POSITION_LABELS } from '#lib/league/labels.ts';
	import { LIMITS, POSITIONS, type Team } from '#lib/league/types.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { submitOnChange, withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';

	interface Props {
		team: Team;
		playersOnField: number;
		/** Only the owner may remove teams and players. */
		canDelete: boolean;
	}

	let { team, playersOnField, canDelete }: Props = $props();

	let confirmingDelete = $state(false);
	let pasting = $state(false);
	let newPlayerName: HTMLInputElement | undefined = $state();

	const missingPlayers = $derived(Math.max(0, playersOnField - team.players.length));
</script>

<section class="panel team" style:--team-color={team.color}>
	<form class="team-head" method="POST" action="?/updateTeam" use:enhance={withFeedback()}>
		<input type="hidden" name="teamId" value={team.id} />
		<input
			type="color"
			name="color"
			value={team.color}
			aria-label="Color de {team.name}"
			onchange={submitOnChange}
		/>
		<input
			class="input team-name"
			name="name"
			value={team.name}
			maxlength={LIMITS.teamName}
			required
			aria-label="Nombre del equipo"
			onchange={submitOnChange}
		/>
		{#if canDelete}
			<button
				type="button"
				class="icon-btn danger"
				aria-label="Eliminar {team.name}"
				onclick={() => (confirmingDelete = true)}
			>
				<Icon name="trash" />
			</button>
		{/if}
	</form>

	<p class="count" class:short={missingPlayers > 0}>
		{plural(team.players.length, 'jugador', 'jugadores')}
		{#if missingPlayers > 0}
			· {missingPlayers === 1 ? 'falta 1' : `faltan ${missingPlayers}`} para completar los {playersOnField}
			en cancha
		{/if}
	</p>

	{#if team.players.length > 0}
		<ul class="roster">
			{#each team.players as player (player.id)}
				<li class="player">
					<form
						class="player-fields"
						method="POST"
						action="?/updatePlayer"
						use:enhance={withFeedback()}
					>
						<input type="hidden" name="playerId" value={player.id} />
						<input
							class="input"
							name="number"
							value={player.number ?? ''}
							inputmode="numeric"
							maxlength="3"
							placeholder="N.º"
							aria-label="Número de {player.name}"
							onchange={submitOnChange}
						/>
						<input
							class="input"
							name="name"
							value={player.name}
							maxlength={LIMITS.playerName}
							required
							aria-label="Nombre del jugador"
							onchange={submitOnChange}
						/>
						<select
							class="input"
							name="position"
							value={player.position ?? ''}
							aria-label="Posición de {player.name}"
							onchange={submitOnChange}
						>
							<option value="">Posición</option>
							{#each POSITIONS as position (position)}
								<option value={position}>{POSITION_LABELS[position]}</option>
							{/each}
						</select>
					</form>
					{#if canDelete}
						<form method="POST" action="?/deletePlayer" use:enhance={withFeedback()}>
							<input type="hidden" name="playerId" value={player.id} />
							<button class="icon-btn danger" aria-label="Quitar a {player.name}">
								<Icon name="trash" />
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<form
		class="player-fields add"
		method="POST"
		action="?/addPlayer"
		use:enhance={withFeedback({ reset: true, onSuccess: () => newPlayerName?.focus() })}
	>
		<input type="hidden" name="teamId" value={team.id} />
		<input
			class="input"
			name="number"
			inputmode="numeric"
			maxlength="3"
			placeholder="N.º"
			aria-label="Número del nuevo jugador"
		/>
		<input
			bind:this={newPlayerName}
			class="input"
			name="name"
			maxlength={LIMITS.playerName}
			required
			placeholder="Nombre del jugador"
			aria-label="Nombre del nuevo jugador"
		/>
		<button class="btn btn-sm">Añadir</button>
	</form>

	{#if pasting}
		<form
			class="paste"
			method="POST"
			action="?/addPlayers"
			use:enhance={withFeedback({ reset: true, onSuccess: () => (pasting = false) })}
		>
			<input type="hidden" name="teamId" value={team.id} />
			<textarea
				class="input"
				name="players"
				rows="4"
				required
				placeholder="10 Luis Marcano, Pedro Rojas… (uno por línea o separados por comas)"
				aria-label="Lista de jugadores"></textarea>
			<div class="btn-row">
				<button class="btn btn-sm btn-primary">Añadir todos</button>
				<button type="button" class="btn btn-sm" onclick={() => (pasting = false)}>Cancelar</button>
			</div>
		</form>
	{:else}
		<button
			type="button"
			class="btn btn-sm btn-quiet paste-toggle"
			onclick={() => (pasting = true)}
		>
			Pegar una lista de jugadores
		</button>
	{/if}
</section>

<Dialog bind:open={confirmingDelete} title="Eliminar {team.name}">
	<p>
		Se quitan sus jugadores y todos sus partidos del calendario. Esta acción no se puede deshacer.
	</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmingDelete = false)}>Cancelar</button>
		<form
			method="POST"
			action="?/deleteTeam"
			use:enhance={withFeedback({ onSuccess: () => (confirmingDelete = false) })}
		>
			<input type="hidden" name="teamId" value={team.id} />
			<button class="btn btn-danger-solid">Eliminar equipo</button>
		</form>
	{/snippet}
</Dialog>

<style>
	.team {
		border-top: 5px solid var(--team-color);
	}

	.team-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.team-name {
		flex: 1 1 180px;
		padding: 5px 10px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.3rem;
	}

	.count {
		margin-bottom: 8px;
		color: var(--color-text-muted);
		font-size: 0.84rem;
	}

	.count.short {
		color: var(--color-loss);
		font-weight: 600;
	}

	.roster {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.player {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 4px;
		padding: 4px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.player-fields {
		display: grid;
		grid-template-columns: 58px 1fr 118px;
		gap: 6px;
	}

	.player-fields .input {
		min-height: 36px;
		padding: 6px 8px;
	}

	.player-fields.add {
		grid-template-columns: 58px 1fr auto;
		margin-top: 10px;
	}

	.paste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 10px;
	}

	.paste-toggle {
		margin-top: 8px;
	}

	@media (max-width: 540px) {
		.player-fields {
			grid-template-columns: 52px 1fr;
		}

		.player-fields select {
			grid-column: 1 / -1;
		}

		.player-fields.add {
			grid-template-columns: 52px 1fr auto;
		}
	}
</style>
