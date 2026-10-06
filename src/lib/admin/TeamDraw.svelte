<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		describeTeamSizes,
		drawTeams,
		maxTeamCount,
		MIN_TEAM_SIZE,
		teamSizes,
		type DrawPerson
	} from '#lib/league/draw.ts';
	import { plural } from '#lib/league/format.ts';
	import { parsePlayers } from '#lib/league/roster-text.ts';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';

	interface Props {
		/** Names already taken, so the new teams get free ones. */
		existingNames: string[];
		ondone: () => void;
	}

	let { existingNames, ondone }: Props = $props();

	let text = $state('');
	/** Lower-cased names of the people marked as the best players. */
	let seeded = $state<string[]>([]);
	let chosenTeamCount = $state<number | null>(null);
	let drawn = $state<DrawPerson[][] | null>(null);

	const keyOf = (name: string) => name.toLocaleLowerCase('es');

	const people = $derived<DrawPerson[]>(
		parsePlayers(text).map((person) => ({
			...person,
			seeded: seeded.includes(keyOf(person.name))
		}))
	);
	const mostTeams = $derived(maxTeamCount(people.length));
	const teamCount = $derived(Math.min(Math.max(chosenTeamCount ?? mostTeams, 2), mostTeams));
	const canDraw = $derived(mostTeams >= 2);

	/** "Equipo 1", "Equipo 2"… skipping numbers that are already in use. */
	const teamNames = $derived.by(() => {
		const taken = new Set(existingNames.map(keyOf));
		const names: string[] = [];
		for (let number = 1; names.length < (drawn?.length ?? 0); number++) {
			const name = `Equipo ${number}`;
			if (!taken.has(keyOf(name))) names.push(name);
		}
		return names;
	});
	const payload = $derived(
		JSON.stringify(
			(drawn ?? []).map((team, index) => ({
				name: teamNames[index],
				players: team.map(({ name, number }) => ({ name, number }))
			}))
		)
	);

	function toggleSeed(name: string) {
		const key = keyOf(name);
		seeded = seeded.includes(key) ? seeded.filter((other) => other !== key) : [...seeded, key];
		drawn = null;
	}

	function draw() {
		drawn = drawTeams(people, teamCount);
	}
</script>

<div class="stack">
	<label class="field">
		<span class="field-label">Personas que van a jugar</span>
		<textarea
			class="input"
			rows="7"
			bind:value={text}
			oninput={() => (drawn = null)}
			placeholder="Luis Marcano, Pedro Rojas, Ana Brito… (una por línea o separadas por comas)"
		></textarea>
		<span class="help">
			{plural(people.length, 'persona')} · mínimo {MIN_TEAM_SIZE} por equipo.
		</span>
	</label>

	{#if people.length > 0}
		<div class="field">
			<span class="field-label">Toca a los mejores jugadores</span>
			<span class="help">Se reparten primero, uno por equipo, para que no queden juntos.</span>
			<div class="chips">
				{#each people as person, index (index)}
					<button
						type="button"
						class="chip"
						aria-pressed={person.seeded}
						onclick={() => toggleSeed(person.name)}
					>
						{#if person.seeded}<Icon name="star" size={13} />{/if}
						{person.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if canDraw}
		<div class="field">
			<span class="field-label">Cantidad de equipos</span>
			<div class="stepper">
				<button
					type="button"
					class="btn"
					aria-label="Un equipo menos"
					disabled={teamCount <= 2}
					onclick={() => ((chosenTeamCount = teamCount - 1), (drawn = null))}>−</button
				>
				<strong>{teamCount}</strong>
				<button
					type="button"
					class="btn"
					aria-label="Un equipo más"
					disabled={teamCount >= mostTeams}
					onclick={() => ((chosenTeamCount = teamCount + 1), (drawn = null))}>+</button
				>
				<span class="help">{describeTeamSizes(teamSizes(people.length, teamCount))}</span>
			</div>
		</div>

		<div class="btn-row">
			<button type="button" class={['btn', !drawn && 'btn-primary']} onclick={draw}>
				<Icon name="shuffle" />
				{drawn ? 'Volver a sortear' : 'Sortear equipos'}
			</button>
		</div>
	{:else if people.length > 0}
		<p class="warn">
			Hacen falta al menos {MIN_TEAM_SIZE * 2} personas para armar dos equipos de {MIN_TEAM_SIZE}.
		</p>
	{/if}

	{#if drawn}
		<ul class="result">
			{#each drawn as team, index (index)}
				<li>
					<strong>{teamNames[index]}</strong>
					<span>
						{#each team as person, position (position)}
							{position > 0 ? ', ' : ''}{#if person.seeded}<Icon name="star" size={12} />{/if}
							{person.name}
						{/each}
					</span>
				</li>
			{/each}
		</ul>
		<form method="POST" action="?/createTeams" use:enhance={withFeedback({ onSuccess: ondone })}>
			<input type="hidden" name="drawn" value={payload} />
			<p class="help">Después puedes cambiarle el nombre y el color a cada equipo.</p>
			<button class="btn btn-primary">Crear estos {drawn.length} equipos</button>
		</form>
	{/if}
</div>

<style>
	textarea {
		line-height: 1.4;
		resize: vertical;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 36px;
		padding: 6px 12px;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-bg);
		color: inherit;
		font-weight: 500;
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: 700;
	}

	.stepper {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.stepper strong {
		min-width: 28px;
		font-family: var(--font-display);
		font-size: 1.6rem;
		text-align: center;
	}

	.result {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.result li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
		border-radius: var(--radius-m);
		background: var(--color-bg);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
</style>
