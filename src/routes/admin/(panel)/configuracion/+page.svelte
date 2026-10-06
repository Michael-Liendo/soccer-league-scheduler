<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatDate, todayIso } from '#lib/league/format.ts';
	import { CARD_LABELS } from '#lib/league/labels.ts';
	import { CARD_TYPES, LIMITS } from '#lib/league/types.ts';
	import { fairPlayLegend } from '#lib/league/view.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import { toasts } from '#lib/ui/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface NewCode {
		label: string;
		code: string;
	}

	const tournament = $derived(data.league.tournament);
	let confirmingReset = $state(false);
	/** The code that was just created. It is shown once and never again. */
	let created = $state<NewCode | null>(null);

	const dayOf = (timestamp: number) =>
		formatDate(todayIso(undefined, new Date(timestamp)), 'short');
	const codeMessage = $derived(
		created
			? `Hola ${created.label}, esta es tu clave para ayudar en ${tournament.name}: ${created.code}\nEntra en ${page.url.origin}/admin`
			: ''
	);

	async function copyCode() {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created.code);
			toasts.show('Clave copiada');
		} catch {
			toasts.error('No se pudo copiar. Selecciona la clave y cópiala a mano.');
		}
	}

	const publicUrl = $derived(`${page.url.origin}/`);
	const whatsappUrl = $derived(
		`https://wa.me/?text=${encodeURIComponent(`Tabla, partidos y goleadores de ${tournament.name}: ${publicUrl}`)}`
	);

	async function copyPublicUrl() {
		try {
			await navigator.clipboard.writeText(publicUrl);
			toasts.show('Link copiado');
		} catch {
			toasts.error('No se pudo copiar. Selecciona el link y cópialo a mano.');
		}
	}
</script>

<div class="two-columns">
	<section class="panel">
		<h2 class="panel-title">General</h2>
		<!-- A fresh form after every save, so the fields show what is stored. -->
		{#key tournament.updatedAt}
			<form class="stack" method="POST" action="?/saveSettings" use:enhance={withFeedback()}>
				<label class="field">
					<span class="field-label">Nombre de la copa</span>
					<input
						class="input"
						name="name"
						value={tournament.name}
						maxlength={LIMITS.leagueName}
						required
					/>
				</label>
				<label class="field">
					<span class="field-label">Lugar</span>
					<input
						class="input"
						name="location"
						value={tournament.location}
						maxlength={LIMITS.location}
						required
					/>
				</label>
				<label class="field">
					<span class="field-label">Cancha</span>
					<input
						class="input"
						name="venue"
						value={tournament.venue}
						maxlength={LIMITS.venue}
						placeholder="Ej. Cancha del malecón"
					/>
					<span class="help">
						Aparece en cada partido. Un partido puede tener otra cancha desde “Partidos”.
					</span>
				</label>
				<label class="field">
					<span class="field-label">Jugadores en cancha por equipo</span>
					<input
						class="input short"
						type="number"
						name="playersOnField"
						value={tournament.playersOnField}
						min={LIMITS.minPlayersOnField}
						max={LIMITS.maxPlayersOnField}
						required
						inputmode="numeric"
					/>
					<span class="help">
						Mínimo {LIMITS.minPlayersOnField}. Se usa para avisar cuando a una plantilla le faltan
						jugadores.
					</span>
				</label>
				<fieldset class="field cards">
					<legend class="field-label">Tarjetas que se usan</legend>
					<div class="checks">
						{#each CARD_TYPES as card (card)}
							<label class="check">
								<input
									type="checkbox"
									name="cards"
									value={card}
									checked={tournament.cards.includes(card)}
								/>
								<span class={['card', card]}></span>
								{CARD_LABELS[card]}
							</label>
						{/each}
					</div>
					<span class="help">
						Solo estas salen al anotar un partido y en las estadísticas. La azul manda al jugador
						unos minutos fuera.
					</span>
				</fieldset>
				<p class="help">
					Puntos: victoria {tournament.pointsWin}, empate {tournament.pointsDraw}, derrota
					{tournament.pointsLoss}. La tabla ordena por puntos; si hay empate decide la diferencia de
					goles, luego los goles a favor y después el juego limpio.
					{fairPlayLegend(tournament.cards)}
				</p>
				<div class="btn-row">
					<button class="btn btn-primary">Guardar</button>
				</div>
			</form>
		{/key}
	</section>

	<div class="stack">
		<section class="panel">
			<h2 class="panel-title">Claves de ayudantes</h2>
			<p class="help">
				Dale una clave a quien te ayude a llevar los partidos. Con ella puede cargar equipos y
				jugadores, iniciar partidos y anotar goles y tarjetas, pero no borrar equipos, jugadores ni
				resultados, ni tocar el calendario o esta configuración.
			</p>
			{#if data.accessCodes.length > 0}
				<ul class="codes">
					{#each data.accessCodes as code (code.id)}
						<li>
							<span>
								<strong>{code.label}</strong>
								<small class="muted">
									{code.lastUsedAt
										? `Entró por última vez el ${dayOf(code.lastUsedAt)}`
										: 'Aún no ha entrado'}
								</small>
							</span>
							<form method="POST" action="?/revokeCode" use:enhance={withFeedback()}>
								<input type="hidden" name="codeId" value={code.id} />
								<button class="btn btn-sm btn-danger">Revocar</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<form
				class="new-code"
				method="POST"
				action="?/createCode"
				use:enhance={withFeedback({
					reset: true,
					onSuccess: (result) => (created = (result?.newCode as NewCode | undefined) ?? null)
				})}
			>
				<input
					class="input"
					name="label"
					maxlength={LIMITS.playerName}
					required
					placeholder="¿Para quién es? Ej. Pedro"
					aria-label="Nombre de quien va a usar la clave"
				/>
				<button class="btn">Crear clave</button>
			</form>
		</section>

		<section class="panel">
			<h2 class="panel-title">Vista pública</h2>
			<p class="help">
				Quien abra este link ve la tabla, los partidos, las estadísticas y los equipos sin código y
				sin poder cambiar nada. Se actualiza sola cada vez que guardas.
			</p>
			<label class="field">
				<span class="field-label">Link de la copa</span>
				<input
					class="input"
					readonly
					value={publicUrl}
					onfocus={(event) => event.currentTarget.select()}
				/>
			</label>
			<div class="btn-row">
				<button type="button" class="btn" onclick={copyPublicUrl}>
					<Icon name="copy" /> Copiar link
				</button>
				<a class="btn btn-primary" href={whatsappUrl} target="_blank" rel="noopener external">
					Enviar por WhatsApp
				</a>
			</div>
		</section>

		<section class="panel">
			<h2 class="panel-title">Respaldo</h2>
			<p class="help">
				Descarga una copia de todo: equipos, jugadores, calendario y resultados. Conviene bajarla al
				terminar cada jornada.
			</p>
			<div class="btn-row">
				<a class="btn" href={resolve('admin/respaldo')} download data-sveltekit-reload>
					Descargar respaldo
				</a>
			</div>
		</section>

		<section class="panel danger">
			<h2 class="panel-title">Reiniciar torneo</h2>
			<p class="help">
				Borra equipos, jugadores, calendario y resultados, y vuelve a la configuración inicial.
			</p>
			<div class="btn-row">
				<button type="button" class="btn btn-danger" onclick={() => (confirmingReset = true)}>
					Reiniciar torneo
				</button>
			</div>
		</section>
	</div>
</div>

<Dialog
	bind:open={() => created !== null, (open) => !open && (created = null)}
	title="Clave para {created?.label ?? ''}"
>
	{#if created}
		<p class="code">{created.code}</p>
		<p class="help">
			Cópiala o envíala ahora: no se vuelve a mostrar. Si se pierde, revoca esta clave y crea otra.
		</p>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn" onclick={copyCode}><Icon name="copy" /> Copiar clave</button>
		<a
			class="btn btn-primary"
			href="https://wa.me/?text={encodeURIComponent(codeMessage)}"
			target="_blank"
			rel="noopener external"
		>
			Enviar por WhatsApp
		</a>
	{/snippet}
</Dialog>

<Dialog bind:open={confirmingReset} title="Reiniciar torneo">
	<p>
		Se borran todos los equipos, jugadores, partidos y resultados. Esta acción no se puede deshacer.
	</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmingReset = false)}>Cancelar</button>
		<form
			method="POST"
			action="?/reset"
			use:enhance={withFeedback({ onSuccess: () => (confirmingReset = false) })}
		>
			<button class="btn btn-danger-solid">Reiniciar</button>
		</form>
	{/snippet}
</Dialog>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.short {
		max-width: 120px;
	}

	.cards {
		margin: 0;
		padding: 0;
		border: 0;
	}

	.cards legend {
		padding: 0;
	}

	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 18px;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-height: 36px;
		font-weight: 600;
		cursor: pointer;
	}

	.card {
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

	.codes {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.codes li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.codes span {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.new-code {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
	}

	.code {
		padding: 14px;
		border-radius: var(--radius-m);
		background: var(--color-bg);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.9rem;
		letter-spacing: 0.04em;
		text-align: center;
		user-select: all;
	}
</style>
