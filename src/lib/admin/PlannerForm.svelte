<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		addDays,
		capitalize,
		formatDate,
		formatDuration,
		formatTime,
		isClockTime,
		isIsoDate,
		plural
	} from '#lib/league/format.ts';
	import { LEG_DESCRIPTIONS, LEG_LABELS } from '#lib/league/labels.ts';
	import {
		dayCapacity,
		dayEndTime,
		distributeByRounds,
		distributeEvenly,
		planOptions,
		suggestMatchesPerDay,
		totalMatches,
		USUAL_MAX_LEGS,
		type PlanTiming
	} from '#lib/league/schedule.ts';
	import { LIMITS, type League } from '#lib/league/types.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';

	interface Props {
		league: League;
	}

	interface DayRow {
		/** Stable key for the list, since new days have no id yet. */
		key: number;
		id: number | null;
		date: string;
		matches: number | null;
	}

	let { league }: Props = $props();

	const teamCount = $derived(league.teams.length);
	const hasCalendar = $derived(league.matches.length > 0);
	const hasResults = $derived(league.matches.some((match) => match.status !== 'pending'));

	let nextKey = 1;

	function initialTiming(): PlanTiming {
		const { startTime, endTime, matchMinutes, breakMinutes } = league.tournament;
		return { startTime, endTime, matchMinutes, breakMinutes };
	}

	function initialLegs(): number {
		if (league.matches.length > 0) return league.tournament.legs;
		const options = planOptions(league.teams.length, league.matchDays.length, initialTiming());
		return options.find((option) => option.recommended)?.legs ?? 1;
	}

	function initialRows(): DayRow[] {
		const legs = initialLegs();
		const played = league.matchDays.map(
			(day) => league.matches.filter((match) => match.matchDayId === day.id).length
		);
		const calendarMatchesFormat =
			league.matches.length > 0 &&
			league.matches.length === totalMatches(league.teams.length, legs);
		const suggested = suggestMatchesPerDay(
			league.teams.length,
			legs,
			league.matchDays.length,
			initialTiming()
		).matchesPerDay;
		return league.matchDays.map((day, index) => ({
			key: nextKey++,
			id: day.id,
			date: day.date,
			matches: calendarMatchesFormat ? played[index] : (suggested[index] ?? 0)
		}));
	}

	let timing = $state(initialTiming());
	let legs = $state(initialLegs());
	let rows = $state(initialRows());

	let form: HTMLFormElement | undefined = $state();
	let pending = $state(false);
	let confirmingGenerate = $state(false);
	let confirmingClear = $state(false);
	let submitter: HTMLButtonElement | null = null;

	const timingIsValid = $derived(
		isClockTime(timing.startTime) &&
			isClockTime(timing.endTime) &&
			Number.isInteger(timing.matchMinutes) &&
			timing.matchMinutes >= LIMITS.minMatchMinutes &&
			Number.isInteger(timing.breakMinutes) &&
			timing.breakMinutes >= 0
	);
	const capacity = $derived(timingIsValid ? dayCapacity(timing) : 0);
	const options = $derived(timingIsValid ? planOptions(teamCount, rows.length, timing) : []);
	// Longer formats stay out of the way unless the days have room for them or one is in use.
	const offeredOptions = $derived(
		options.filter((option) => option.legs <= USUAL_MAX_LEGS || option.fits || option.legs === legs)
	);
	const expectedTotal = $derived(totalMatches(teamCount, legs));
	const plannedTotal = $derived(rows.reduce((sum, row) => sum + (row.matches ?? 0), 0));
	const difference = $derived(expectedTotal - plannedTotal);
	const wholeRounds = $derived(distributeByRounds(teamCount, legs, rows.length));
	const canGenerate = $derived(teamCount >= 2 && timingIsValid && difference === 0 && !pending);

	function setMatchesPerDay(matchesPerDay: readonly number[]) {
		rows.forEach((row, index) => (row.matches = matchesPerDay[index] ?? 0));
	}

	/** Fills the matches per day with the suggestion for the selected format and timetable. */
	function useSuggestion() {
		if (!timingIsValid || teamCount < 2) return;
		setMatchesPerDay(suggestMatchesPerDay(teamCount, legs, rows.length, timing).matchesPerDay);
	}

	function sortRows() {
		rows.sort((a, b) => a.date.localeCompare(b.date));
	}

	function addDay() {
		const lastDate = rows.at(-1)?.date;
		const date = lastDate && isIsoDate(lastDate) ? addDays(lastDate, 7) : '';
		rows.push({ key: nextKey++, id: null, date, matches: 0 });
		useSuggestion();
	}

	function removeDay(key: number) {
		rows = rows.filter((row) => row.key !== key);
		useSuggestion();
	}

	function confirmBeforeReplacing(event: MouseEvent) {
		if (!hasCalendar) return;
		event.preventDefault();
		submitter = event.currentTarget as HTMLButtonElement;
		confirmingGenerate = true;
	}

	function generateConfirmed() {
		confirmingGenerate = false;
		form?.requestSubmit(submitter);
	}
</script>

<form
	bind:this={form}
	class="stack"
	method="POST"
	action="?/savePlan"
	use:enhance={withFeedback({ pending: (isPending) => (pending = isPending) })}
>
	<section class="panel">
		<div class="panel-head">
			<div>
				<h2 class="panel-title">Días y horario</h2>
				<p class="help">
					Los días en que se juega la copa y a qué hora. Si cambias una fecha, los partidos de ese
					día se mueven con ella.
				</p>
			</div>
		</div>

		<ul class="days">
			{#each rows as row, index (row.key)}
				<li class="day-row">
					<span class="day-number">Jornada {index + 1}</span>
					<input type="hidden" name="dayId" value={row.id ?? ''} />
					<input
						class="input"
						type="date"
						name="dayDate"
						bind:value={row.date}
						required
						aria-label="Fecha de la jornada {index + 1}"
						onchange={sortRows}
					/>
					<span class="weekday muted">
						{isIsoDate(row.date) ? capitalize(formatDate(row.date, 'long')) : ''}
					</span>
					<button
						type="button"
						class="icon-btn danger"
						aria-label="Quitar la jornada {index + 1}"
						disabled={rows.length <= 1}
						onclick={() => removeDay(row.key)}
					>
						<Icon name="trash" />
					</button>
				</li>
			{/each}
		</ul>
		<button
			type="button"
			class="btn btn-sm"
			disabled={rows.length >= LIMITS.maxMatchDays}
			onclick={addDay}
		>
			<Icon name="plus" /> Añadir día
		</button>

		<div class="field-grid timing">
			<label class="field">
				<span class="field-label">Primer partido</span>
				<input
					class="input"
					type="time"
					name="startTime"
					bind:value={timing.startTime}
					required
					onchange={useSuggestion}
				/>
			</label>
			<label class="field">
				<span class="field-label">Hora límite</span>
				<input
					class="input"
					type="time"
					name="endTime"
					bind:value={timing.endTime}
					required
					onchange={useSuggestion}
				/>
			</label>
			<label class="field">
				<span class="field-label">Minutos por partido</span>
				<input
					class="input"
					type="number"
					name="matchMinutes"
					bind:value={timing.matchMinutes}
					min={LIMITS.minMatchMinutes}
					max={LIMITS.maxMatchMinutes}
					required
					inputmode="numeric"
					onchange={useSuggestion}
				/>
			</label>
			<label class="field">
				<span class="field-label">Descanso entre partidos</span>
				<input
					class="input"
					type="number"
					name="breakMinutes"
					bind:value={timing.breakMinutes}
					min="0"
					max={LIMITS.maxBreakMinutes}
					required
					inputmode="numeric"
					onchange={useSuggestion}
				/>
			</label>
		</div>
		{#if timingIsValid}
			<p class="help capacity">
				Con este horario caben <strong>{plural(capacity, 'partido')}</strong> por día: uno cada
				{timing.matchMinutes + timing.breakMinutes} minutos.
			</p>
		{:else}
			<p class="warn capacity">Completa el horario para calcular cuántos partidos caben.</p>
		{/if}
		<div class="btn-row">
			<button class="btn" disabled={pending}>Guardar días y horario</button>
		</div>
	</section>

	<section class="panel">
		<div class="panel-head">
			<div>
				<h2 class="panel-title">Formato</h2>
				<p class="help">
					{plural(teamCount, 'equipo')} en {plural(rows.length, 'día')}. Elige cuántas veces se
					enfrenta cada pareja de equipos; la opción recomendada da a cada equipo entre 2 y 3
					partidos por día sin pasarse de la hora límite.
				</p>
			</div>
		</div>

		{#if teamCount < 2}
			<div class="empty">Añade al menos 2 equipos para ver los formatos posibles.</div>
		{:else}
			<div class="options">
				{#each offeredOptions as option (option.legs)}
					<label class="option" class:selected={legs === option.legs}>
						<input
							class="visually-hidden"
							type="radio"
							name="legs"
							value={option.legs}
							bind:group={legs}
							onchange={useSuggestion}
						/>
						<span class="option-title">
							{LEG_LABELS[option.legs]}
							{#if option.recommended}
								<span class="badge badge-accent"><Icon name="star" size={12} /> Recomendado</span>
							{/if}
						</span>
						<span class="help option-description">{LEG_DESCRIPTIONS[option.legs]}</span>
						<span class="option-stats">
							<span><strong>{option.totalMatches}</strong> partidos</span>
							<span><strong>{option.gamesPerTeam}</strong> por equipo</span>
						</span>
						<span><strong>{option.matchesPerDay.join(' · ')}</strong> por día</span>
						{#if option.fits}
							<span class="help">
								Día más largo: {formatDuration(option.longestDayMinutes)}
							</span>
						{:else}
							<span class="warn">
								No cabe: terminaría a las
								{formatTime(dayEndTime(option.longestDayMatches, timing))}
							</span>
						{/if}
					</label>
				{/each}
			</div>
		{/if}
	</section>

	<section class="panel">
		<div class="panel-head">
			<div>
				<h2 class="panel-title">Partidos por día</h2>
				<p class="help">
					Ya viene repartido con lo recomendado. Puedes cambiar los números a mano mientras el total
					coincida con el formato.
				</p>
			</div>
			<div class="btn-row">
				<button
					type="button"
					class="btn btn-sm"
					disabled={!wholeRounds}
					title="Cada equipo juega lo mismo cada día"
					onclick={() => wholeRounds && setMatchesPerDay(wholeRounds)}
				>
					Rondas completas
				</button>
				<button
					type="button"
					class="btn btn-sm"
					title="Todos los días duran casi lo mismo"
					onclick={() => setMatchesPerDay(distributeEvenly(expectedTotal, rows.length))}
				>
					Reparto parejo
				</button>
			</div>
		</div>

		<ul class="plan">
			{#each rows as row, index (row.key)}
				{@const matches = row.matches ?? 0}
				<li class="plan-row">
					<span class="day-label">
						<strong>Jornada {index + 1}</strong>
						<span class="muted nowrap">
							{isIsoDate(row.date) ? formatDate(row.date, 'medium') : ''}
						</span>
					</span>
					<input
						class="input count"
						type="number"
						name="dayMatches"
						bind:value={row.matches}
						min="0"
						max="99"
						required
						inputmode="numeric"
						aria-label="Partidos de la jornada {index + 1}"
					/>
					<span class="plan-hours">
						{#if matches === 0}
							<span class="muted">Sin partidos</span>
						{:else if timingIsValid}
							<span class="nowrap">
								{formatTime(timing.startTime)} – {formatTime(dayEndTime(matches, timing))}
							</span>
							{#if matches > capacity}
								<span class="warn">Pasa de la hora límite</span>
							{/if}
						{/if}
					</span>
				</li>
			{/each}
			<li class="plan-row plan-total">
				<span class="day-label"><strong>Total</strong></span>
				<span class="count total" class:off={difference !== 0}>
					{plannedTotal} de {expectedTotal}
				</span>
				<span class="plan-hours">
					{#if difference > 0}
						<span class="warn">
							{difference === 1 ? 'Falta 1 partido' : `Faltan ${difference} partidos`} por repartir
						</span>
					{:else if difference < 0}
						<span class="warn">
							{difference === -1 ? 'Sobra 1 partido' : `Sobran ${-difference} partidos`}
						</span>
					{/if}
				</span>
			</li>
		</ul>

		<div class="btn-row generate">
			<button
				class="btn btn-primary"
				formaction="?/generate"
				name="draw"
				value="ordered"
				disabled={!canGenerate}
				onclick={confirmBeforeReplacing}
			>
				<Icon name="calendar" />
				{hasCalendar ? 'Volver a generar' : 'Generar calendario'}
			</button>
			<button
				class="btn"
				formaction="?/generate"
				name="draw"
				value="random"
				disabled={!canGenerate}
				onclick={confirmBeforeReplacing}
			>
				<Icon name="shuffle" /> Sortear calendario
			</button>
			{#if hasCalendar}
				<button type="button" class="btn btn-danger" onclick={() => (confirmingClear = true)}>
					Borrar calendario
				</button>
			{/if}
		</div>
		<p class="help">
			“Generar” arma los cruces en el orden en que creaste los equipos y “Sortear” los mezcla al
			azar. En ambos casos cada equipo descansa entre un partido y otro siempre que se puede.
		</p>
	</section>
</form>

<Dialog bind:open={confirmingGenerate} title="Reemplazar el calendario">
	<p>
		Se arma un calendario nuevo y se pierde el actual, con sus fechas y horas.
		{#if hasResults}
			<strong>También se borran los resultados, goles y tarjetas ya cargados.</strong>
		{/if}
	</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmingGenerate = false)}>
			Cancelar
		</button>
		<button
			type="button"
			class={['btn', hasResults ? 'btn-danger-solid' : 'btn-primary']}
			onclick={generateConfirmed}
		>
			Reemplazar calendario
		</button>
	{/snippet}
</Dialog>

<Dialog bind:open={confirmingClear} title="Borrar el calendario">
	<p>
		Se quitan todos los partidos. Los equipos y sus jugadores se conservan.
		{#if hasResults}
			<strong>También se borran los resultados ya cargados.</strong>
		{/if}
	</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmingClear = false)}>Cancelar</button>
		<form
			method="POST"
			action="?/clear"
			use:enhance={withFeedback({ onSuccess: () => (confirmingClear = false) })}
		>
			<button class="btn btn-danger-solid">Borrar calendario</button>
		</form>
	{/snippet}
</Dialog>

<style>
	.days {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0 0 10px;
		padding: 0;
		list-style: none;
	}

	.day-row {
		display: grid;
		grid-template-columns: 92px minmax(150px, 190px) 1fr auto;
		align-items: center;
		gap: 10px;
	}

	.day-number {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
	}

	.weekday {
		font-size: 0.9rem;
	}

	.timing {
		margin-top: 18px;
	}

	.capacity {
		margin: 10px 0 14px;
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
	}

	.option {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-l);
		background: var(--color-bg);
		cursor: pointer;
	}

	.option:hover {
		border-color: var(--color-text-muted);
	}

	.option.selected {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
	}

	.option:has(:focus-visible) {
		outline: 3px solid var(--color-accent);
		outline-offset: 2px;
	}

	.option-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.35rem;
		line-height: 1.1;
	}

	.option-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 14px;
	}

	.option strong {
		font-family: var(--font-display);
		font-size: 1.15rem;
	}

	.plan {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.plan-row {
		display: grid;
		grid-template-columns: minmax(150px, 1.2fr) 96px 2fr;
		align-items: center;
		gap: 4px 14px;
		padding: 9px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.plan-total {
		border-bottom: 0;
	}

	.day-label,
	.plan-hours {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 10px;
	}

	.count {
		width: 96px;
		text-align: center;
	}

	.total {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
	}

	.total.off {
		color: var(--color-loss);
	}

	.generate {
		margin: 16px 0 10px;
	}

	@media (max-width: 600px) {
		.day-row {
			grid-template-columns: 1fr auto;
		}

		.day-number {
			grid-column: 1 / -1;
		}

		.weekday {
			display: none;
		}

		.option {
			gap: 5px;
			padding: 12px;
		}

		.option-description {
			display: none;
		}

		.plan-row {
			grid-template-columns: 1fr auto;
		}

		.plan-row .count {
			grid-column: 2;
			grid-row: 1 / span 2;
		}

		.plan-hours {
			grid-column: 1;
			font-size: 0.9rem;
		}
	}
</style>
