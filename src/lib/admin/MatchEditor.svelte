<script lang="ts">
	import { enhance } from '$app/forms';
	import { elapsedMs, formatClock, hasClockStarted, isClockRunning } from '#lib/league/clock.ts';
	import { formatDate } from '#lib/league/format.ts';
	import { CARD_LABELS } from '#lib/league/labels.ts';
	import {
		FORFEIT_GOALS,
		goalValue,
		LIMITS,
		type League,
		type Match,
		type MatchEvent,
		type MatchEventType,
		type Team
	} from '#lib/league/types.ts';
	import { sortedPlayers } from '#lib/league/view.ts';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';

	interface Props {
		match: Match;
		league: League;
		/** Current time in epoch milliseconds, ticking. */
		now: number;
		/** Only the owner may wipe the result of a match. */
		canReset: boolean;
	}

	let { match, league, now, canReset }: Props = $props();

	/** What is being recorded, while the player is being picked. */
	let picking = $state<{ teamId: number; type: MatchEventType } | null>(null);
	let confirmingReset = $state(false);

	const home = $derived(league.teams.find((team) => team.id === match.homeTeamId));
	const away = $derived(league.teams.find((team) => team.id === match.awayTeamId));
	const sides = $derived<{ team: Team | undefined; score: number }[]>([
		{ team: home, score: match.homeScore },
		{ team: away, score: match.awayScore }
	]);
	const pickingTeam = $derived(league.teams.find((team) => team.id === picking?.teamId));
	const played = $derived(elapsedMs(match, now));
	const running = $derived(isClockRunning(match));
	const overtime = $derived(played > league.tournament.matchMinutes * 60_000);
	const hasResult = $derived(
		match.status !== 'pending' || match.events.length > 0 || hasClockStarted(match)
	);

	/** The team that did not show up, when the match was awarded without playing. */
	const absent = $derived(
		match.forfeitedBy === null ? undefined : match.forfeitedBy === 'home' ? home : away
	);
	const walkoverWinner = $derived(match.forfeitedBy === 'home' ? away : home);
	// A walkover is for a match nobody played: it cannot have goals, cards or a final whistle.
	const canForfeit = $derived(
		match.forfeitedBy === null && match.events.length === 0 && match.status !== 'finished'
	);

	const PICK_TITLES: Record<MatchEventType, string> = {
		goal: '¿Quién metió el gol?',
		double_goal: '¿Quién metió el gol doble?',
		own_goal: 'Autogol',
		yellow: '¿Amarilla para quién?',
		blue: '¿Azul para quién?',
		red: '¿Roja para quién?'
	};

	function eventLabel(event: MatchEvent): string {
		if (event.type === 'own_goal') return 'Autogol';
		const team = league.teams.find((candidate) => candidate.id === event.teamId);
		const player = team?.players.find((candidate) => candidate.id === event.playerId);
		return player?.name ?? (event.playerName || 'Gol sin goleador');
	}

	const recorded = () => withFeedback({ onSuccess: () => (picking = null) });
</script>

<div class="board">
	<div class="score">
		{#each sides as { team, score }, index (index)}
			<div class="side">
				<span class="name">{team?.name ?? 'Por definir'}</span>
				<output>{score}</output>
			</div>
		{/each}
	</div>

	{#if absent}
		<p class="walkover">W.O. · {absent.name} no se presentó</p>
	{:else}
		<div class="clock" class:overtime>
			<span class="time" aria-live="off">{formatClock(played)}</span>
			<span class="of">de {league.tournament.matchMinutes}:00</span>
		</div>

		<form class="clock-buttons" method="POST" action="?/clock" use:enhance={withFeedback()}>
			<input type="hidden" name="matchId" value={match.id} />
			{#if match.status === 'finished'}
				<button class="btn btn-on-board" name="step" value="start">Reanudar partido</button>
			{:else if running}
				<button class="btn btn-on-board" name="step" value="pause">Pausar</button>
				<button class="btn btn-primary" name="step" value="finish">Finalizar partido</button>
			{:else}
				<button class="btn btn-primary" name="step" value="start">
					{hasClockStarted(match) ? 'Reanudar' : 'Iniciar partido'}
				</button>
				{#if match.status === 'live'}
					<button class="btn btn-on-board" name="step" value="finish">Finalizar partido</button>
				{/if}
			{/if}
		</form>
	{/if}
</div>

{#if absent}
	<p class="help">
		Partido cerrado sin jugarse: gana {walkoverWinner?.name}
		{FORFEIT_GOALS}–0 y nadie suma goles.
	</p>
{:else if picking && pickingTeam}
	<section class="picker">
		<header>
			<h3 class="section-title">{PICK_TITLES[picking.type]}</h3>
			<span class="muted">{pickingTeam.name}</span>
		</header>
		<form class="players" method="POST" action="?/addEvent" use:enhance={recorded()}>
			<input type="hidden" name="matchId" value={match.id} />
			<input type="hidden" name="teamId" value={pickingTeam.id} />
			<input type="hidden" name="type" value={picking.type} />
			{#each sortedPlayers(pickingTeam) as player (player.id)}
				<button class="btn player" name="playerId" value={player.id}>
					{#if player.number}<span class="shirt">{player.number}</span>{/if}
					{player.name}
				</button>
			{/each}
		</form>
		<form class="new-player" method="POST" action="?/addEvent" use:enhance={recorded()}>
			<input type="hidden" name="matchId" value={match.id} />
			<input type="hidden" name="teamId" value={pickingTeam.id} />
			<input type="hidden" name="type" value={picking.type} />
			<input
				class="input"
				name="newPlayer"
				maxlength={LIMITS.playerName}
				required
				placeholder="Otro jugador: escribe su nombre"
				aria-label="Nombre de un jugador nuevo"
			/>
			<button class="btn">Añadir y anotar</button>
		</form>
		<div class="btn-row">
			{#if goalValue(picking.type) > 0}
				<form method="POST" action="?/addEvent" use:enhance={recorded()}>
					<input type="hidden" name="matchId" value={match.id} />
					<input type="hidden" name="teamId" value={pickingTeam.id} />
					{#if picking.type === 'goal'}
						<button class="btn btn-sm btn-quiet" name="type" value="own_goal">Fue autogol</button>
					{/if}
					<button class="btn btn-sm btn-quiet" name="type" value={picking.type}>
						No sé quién fue
					</button>
				</form>
			{/if}
			<button type="button" class="btn btn-sm" onclick={() => (picking = null)}>Cancelar</button>
		</div>
	</section>
{:else}
	<div class="teams">
		{#each sides as { team }, index (index)}
			{#if team}
				<div class="team" style:--team-color={team.color}>
					<span class="team-name">{team.name}</span>
					<button
						type="button"
						class="btn goal"
						onclick={() => (picking = { teamId: team.id, type: 'goal' })}
					>
						<Icon name="ball" size={18} /> Gol
					</button>
					<button
						type="button"
						class="btn double"
						onclick={() => (picking = { teamId: team.id, type: 'double_goal' })}
					>
						Gol doble <span class="times">×2</span>
					</button>
					{#if league.tournament.cards.length > 0}
						<div class="cards">
							{#each league.tournament.cards as card (card)}
								<button
									type="button"
									class="btn"
									aria-label="{CARD_LABELS[card]} para {team.name}"
									onclick={() => (picking = { teamId: team.id, type: card })}
								>
									<span class={['card', card]}></span>
									{CARD_LABELS[card]}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}

{#if !absent}
	<div class="field">
		<span class="field-label">Lo que ha pasado</span>
		{#if match.events.length === 0}
			<p class="help">Aún no hay goles ni tarjetas. Toca “Gol” y elige al jugador.</p>
		{:else}
			<ul class="events">
				{#each match.events as event (event.id)}
					<li>
						<form method="POST" action="?/setMinute" use:enhance={withFeedback()}>
							<input type="hidden" name="eventId" value={event.id} />
							<input
								class="input minute"
								name="minute"
								value={event.minute ?? ''}
								inputmode="numeric"
								maxlength="3"
								placeholder="–"
								aria-label="Minuto"
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
						</form>
						<span class="event">
							{#if goalValue(event.type) > 0}
								<Icon name="ball" />
							{:else}
								<span class={['card', event.type]}></span>
							{/if}
							<strong>{eventLabel(event)}</strong>
							{#if event.type === 'double_goal'}<span class="badge">×2</span>{/if}
							<span class="muted">
								{league.teams.find((team) => team.id === event.teamId)?.name}
							</span>
						</span>
						<form method="POST" action="?/removeEvent" use:enhance={withFeedback()}>
							<input type="hidden" name="eventId" value={event.id} />
							<button class="icon-btn danger" aria-label="Borrar: {eventLabel(event)}">
								<Icon name="trash" />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

{#if canForfeit}
	<details class="more">
		<summary>Un equipo no se presentó (W.O.)</summary>
		<p class="help">
			Toca el equipo que faltó. Su rival gana {FORFEIT_GOALS}–0 y nadie suma goles.
		</p>
		<form class="btn-row" method="POST" action="?/forfeit" use:enhance={withFeedback()}>
			<input type="hidden" name="matchId" value={match.id} />
			{#if home}
				<button class="btn btn-sm btn-danger" name="absent" value="home">
					No se presentó {home.name}
				</button>
			{/if}
			{#if away}
				<button class="btn btn-sm btn-danger" name="absent" value="away">
					No se presentó {away.name}
				</button>
			{/if}
		</form>
	</details>
{/if}

<details class="more">
	<summary>Corregir reloj, día, hora y cancha</summary>
	{#if !absent}
		<form class="inline" method="POST" action="?/setClock" use:enhance={withFeedback()}>
			<input type="hidden" name="matchId" value={match.id} />
			<label class="field">
				<span class="field-label">Minutos jugados</span>
				<input
					class="input"
					type="number"
					name="minutes"
					min="0"
					max={LIMITS.maxClockMinutes}
					value={Math.floor(played / 60_000)}
					required
					inputmode="numeric"
				/>
			</label>
			<button class="btn btn-sm">Poner reloj</button>
		</form>
	{/if}
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
	{#if hasResult && canReset}
		<div class="btn-row">
			{#if confirmingReset}
				<span class="warn">Se borran el marcador, el reloj, los goles y las tarjetas.</span>
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
				<button
					type="button"
					class="btn btn-sm btn-danger"
					onclick={() => (confirmingReset = true)}
				>
					Borrar resultado
				</button>
			{/if}
		</div>
	{/if}
</details>

<style>
	.board {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 12px;
		border-radius: 12px;
		background: var(--color-board);
		color: var(--color-on-board);
		text-align: center;
	}

	.score {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}

	.name {
		font-size: 0.95rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.side output {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 3.4rem;
		line-height: 1;
	}

	.clock {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 8px;
	}

	.time {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 2.2rem;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.clock.overtime .time {
		color: var(--color-accent);
	}

	.of {
		font-size: 0.85rem;
		opacity: 0.75;
	}

	.walkover {
		font-weight: 600;
	}

	.clock-buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}

	.clock-buttons .btn {
		min-height: 46px;
		padding-inline: 18px;
		font-size: 1rem;
	}

	.clock-buttons :global(.btn-on-board) {
		border-color: rgb(255 255 255 / 0.35);
		background: rgb(255 255 255 / 0.12);
		color: inherit;
	}

	.teams {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.team {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		padding: 10px;
		border: 1px solid var(--color-border);
		border-top: 5px solid var(--team-color);
		border-radius: 12px;
	}

	.team-name {
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.goal {
		min-height: 56px;
		font-size: 1.15rem;
	}

	.double {
		gap: 5px;
		min-height: 44px;
		padding-inline: 6px;
		white-space: nowrap;
	}

	.double .times {
		color: var(--color-text-muted);
	}

	.cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.cards .btn {
		gap: 4px;
		min-width: 0;
		padding-inline: 2px;
		font-size: 0.8rem;
	}

	/* Three cards do not fit side by side on a phone, so an odd one out takes a row of its own. */
	.cards .btn:last-child:nth-child(odd) {
		grid-column: 1 / -1;
	}

	.picker {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		border: 2px solid var(--color-accent);
		border-radius: 12px;
	}

	.picker header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
	}

	.players {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px;
	}

	.player {
		justify-content: flex-start;
		min-height: 50px;
		text-align: left;
	}

	.new-player {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
	}

	.picker .btn-row form {
		display: flex;
		flex-wrap: wrap;
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

	.card.blue {
		background: var(--color-blue-card);
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
		display: grid;
		grid-template-columns: 52px 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 6px;
		border-radius: var(--radius-m);
		background: var(--color-bg);
		font-size: 0.92rem;
	}

	.minute {
		min-height: 34px;
		padding: 4px;
		text-align: center;
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

	.more {
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.more summary {
		color: var(--color-text-muted);
		font-weight: 600;
		cursor: pointer;
	}

	.more > :not(summary) {
		margin-top: 14px;
	}

	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px;
	}

	.inline .field {
		max-width: 160px;
	}
</style>
