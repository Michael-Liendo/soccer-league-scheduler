<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate } from '#lib/league/format.ts';
	import { STATUS_LABELS } from '#lib/league/labels.ts';
	import {
		LIMITS,
		MATCH_STATUSES,
		type League,
		type Match,
		type MatchSide,
		type Team
	} from '#lib/league/types.ts';
	import { creditedGoals, sortedPlayers } from '#lib/league/view.ts';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';

	interface Props {
		match: Match;
		league: League;
	}

	let { match, league }: Props = $props();

	let selectedTeamId = $state<number | null>(null);
	let confirmingReset = $state(false);

	const home = $derived(league.teams.find((team) => team.id === match.homeTeamId));
	const away = $derived(league.teams.find((team) => team.id === match.awayTeamId));
	const sides = $derived<{ side: MatchSide; team: Team | undefined; score: number }[]>([
		{ side: 'home', team: home, score: match.homeScore },
		{ side: 'away', team: away, score: match.awayScore }
	]);

	// Goals and cards go to the home team unless the other one is picked.
	const eventTeam = $derived(selectedTeamId === away?.id ? away : home);
	const eventPlayers = $derived(eventTeam ? sortedPlayers(eventTeam) : []);
	const teamNames = $derived(new Map(league.teams.map((team) => [team.id, team.name])));
	const hasResult = $derived(match.status !== 'pending' || match.events.length > 0);

	function playerName(event: Match['events'][number]): string {
		const team = league.teams.find((candidate) => candidate.id === event.teamId);
		const player = team?.players.find((candidate) => candidate.id === event.playerId);
		return player?.name ?? event.playerName;
	}
</script>

<div class="scoreboard">
	{#each sides as { side, team, score } (side)}
		{@const credited = team ? creditedGoals(match, team.id) : 0}
		<form class="side" method="POST" action="?/score" use:enhance={withFeedback()}>
			<input type="hidden" name="matchId" value={match.id} />
			<input type="hidden" name="side" value={side} />
			<span class="name">{team?.name ?? 'Por definir'}</span>
			<div class="stepper">
				<button
					name="delta"
					value="-1"
					disabled={score <= credited}
					aria-label="Restar un gol a {team?.name}"
				>
					−
				</button>
				<output aria-live="polite">{score}</output>
				<button name="delta" value="1" aria-label="Sumar un gol a {team?.name}">+</button>
			</div>
			<small>
				{#if credited === 0}
					Sin goleadores anotados
				{:else}
					{credited === 1 ? '1 gol con goleador' : `${credited} goles con goleador`}
				{/if}
			</small>
		</form>
	{/each}
</div>

<form class="field" method="POST" action="?/status" use:enhance={withFeedback()}>
	<input type="hidden" name="matchId" value={match.id} />
	<span class="field-label">Estado</span>
	<div class="segments">
		{#each MATCH_STATUSES as status (status)}
			<button name="status" value={status} aria-pressed={match.status === status}>
				{STATUS_LABELS[status]}
			</button>
		{/each}
	</div>
</form>

<form class="recorder" method="POST" action="?/addEvent" use:enhance={withFeedback()}>
	<input type="hidden" name="matchId" value={match.id} />
	<span class="field-label">Anotar gol o tarjeta</span>
	<div class="segments">
		{#each [home, away] as team (team?.id)}
			{#if team}
				<label class:checked={eventTeam?.id === team.id}>
					<input
						class="visually-hidden"
						type="radio"
						name="teamId"
						value={team.id}
						checked={eventTeam?.id === team.id}
						onchange={() => (selectedTeamId = team.id)}
					/>
					{team.name}
				</label>
			{/if}
		{/each}
	</div>
	{#if eventPlayers.length === 0}
		<p class="help">
			Este equipo no tiene jugadores cargados. Añádelos en la pestaña Equipos, o usa los botones + y
			− del marcador para llevar el resultado sin goleadores.
		</p>
	{:else}
		<select class="input" name="playerId" aria-label="Jugador">
			{#each eventPlayers as player (player.id)}
				<option value={player.id}>
					{player.number ? `#${player.number} ` : ''}{player.name}
				</option>
			{/each}
		</select>
		<div class="event-buttons">
			<button class="btn" name="type" value="goal">
				<Icon name="ball" />
				Gol
			</button>
			<button class="btn" name="type" value="yellow">
				<span class="card yellow"></span> Amarilla
			</button>
			<button class="btn" name="type" value="red"><span class="card red"></span> Roja</button>
		</div>
	{/if}
</form>

<div class="field">
	<span class="field-label">Goles y tarjetas del partido</span>
	{#if match.events.length === 0}
		<p class="help">Aún no hay goles ni tarjetas anotados.</p>
	{:else}
		<ul class="events">
			{#each match.events as event (event.id)}
				<li>
					<span class="event">
						{#if event.type === 'goal'}
							<Icon name="ball" />
						{:else}
							<span
								class={['card', event.type]}
								title={event.type === 'yellow' ? 'Amarilla' : 'Roja'}
							></span>
						{/if}
						<strong>{playerName(event)}</strong>
						<span class="muted">{teamNames.get(event.teamId)}</span>
					</span>
					<form method="POST" action="?/removeEvent" use:enhance={withFeedback()}>
						<input type="hidden" name="eventId" value={event.id} />
						<button class="icon-btn danger" aria-label="Borrar: {playerName(event)}">
							<Icon name="trash" />
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<details class="schedule">
	<summary>Día, hora y cancha</summary>
	<form class="stack" method="POST" action="?/reschedule" use:enhance={withFeedback()}>
		<input type="hidden" name="matchId" value={match.id} />
		<label class="field">
			<span class="field-label">Jornada</span>
			<select class="input" name="matchDayId" value={match.matchDayId}>
				{#each league.matchDays as day (day.id)}
					<option value={day.id}>Jornada {day.number} · {formatDate(day.date, 'long')}</option>
				{/each}
			</select>
		</label>
		<div class="field-grid">
			<label class="field">
				<span class="field-label">Hora</span>
				<input class="input" type="time" name="time" value={match.time ?? ''} />
			</label>
			<label class="field">
				<span class="field-label">Cancha</span>
				<input
					class="input"
					name="venue"
					value={match.venue ?? ''}
					maxlength={LIMITS.venue}
					placeholder={league.tournament.venue || 'La de la copa'}
				/>
			</label>
		</div>
		<div class="btn-row">
			<button class="btn btn-sm">Guardar día y hora</button>
		</div>
	</form>
</details>

{#if hasResult}
	<div class="reset">
		{#if confirmingReset}
			<span class="warn">Se borran el marcador, los goles y las tarjetas de este partido.</span>
			<form
				method="POST"
				action="?/resetMatch"
				use:enhance={withFeedback({ onSuccess: () => (confirmingReset = false) })}
			>
				<input type="hidden" name="matchId" value={match.id} />
				<button class="btn btn-sm btn-danger-solid">Sí, borrar</button>
			</form>
			<button type="button" class="btn btn-sm" onclick={() => (confirmingReset = false)}>
				No
			</button>
		{:else}
			<button type="button" class="btn btn-sm btn-danger" onclick={() => (confirmingReset = true)}>
				Borrar resultado
			</button>
		{/if}
	</div>
{/if}

<style>
	.scoreboard {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 14px 10px;
		border-radius: 12px;
		background: var(--color-board);
		color: var(--color-on-board);
	}

	.side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		min-width: 0;
		text-align: center;
	}

	.name {
		font-size: 0.95rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.stepper output {
		min-width: 46px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 2.7rem;
		line-height: 1;
	}

	.stepper button {
		width: 44px;
		height: 44px;
		border: 1px solid rgb(255 255 255 / 0.3);
		border-radius: 10px;
		background: rgb(255 255 255 / 0.1);
		color: inherit;
		font-size: 1.35rem;
		cursor: pointer;
	}

	.stepper button[disabled] {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.side small {
		font-size: 0.76rem;
		opacity: 0.75;
	}

	.segments {
		display: flex;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		overflow: hidden;
	}

	.segments > * {
		flex: 1;
		min-width: 0;
		padding: 9px 6px;
		border: 0;
		border-right: 1px solid var(--color-border);
		background: none;
		color: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		text-align: center;
		cursor: pointer;
	}

	.segments > :last-child {
		border-right: 0;
	}

	.segments > [aria-pressed='true'],
	.segments > .checked {
		background: var(--color-text);
		color: var(--color-bg);
	}

	.segments > :has(:focus-visible) {
		outline: 3px solid var(--color-accent);
		outline-offset: -3px;
	}

	.recorder {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--color-border);
		border-radius: 12px;
	}

	.event-buttons {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.card {
		display: inline-block;
		flex: none;
		width: 10px;
		height: 13px;
		border-radius: 2px;
	}

	.card.yellow {
		background: var(--color-yellow-card);
	}

	.card.red {
		background: var(--color-red-card);
	}

	.events {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.events li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 4px 4px 12px;
		border-radius: var(--radius-m);
		background: var(--color-bg);
		font-size: 0.92rem;
	}

	.event {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		min-width: 0;
	}

	.event .muted {
		font-size: 0.84rem;
	}

	.schedule {
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.schedule summary {
		color: var(--color-text-muted);
		font-weight: 600;
		cursor: pointer;
	}

	.schedule form {
		margin-top: 12px;
	}

	.reset {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	@media (max-width: 480px) {
		.scoreboard {
			padding-inline: 6px;
		}

		.stepper {
			gap: 4px;
		}

		.stepper button {
			width: 40px;
			height: 40px;
		}

		.stepper output {
			min-width: 40px;
			font-size: 2.4rem;
		}

		.event-buttons {
			gap: 6px;
		}

		.event-buttons .btn {
			padding-inline: 6px;
		}
	}
</style>
