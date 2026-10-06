<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { LIMITS } from '#lib/league/types.ts';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import { toasts } from '#lib/ui/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let confirmingReset = $state(false);

	const tournament = $derived(data.league.tournament);
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
				<div class="btn-row">
					<button class="btn btn-primary">Guardar</button>
				</div>
			</form>
		{/key}
	</section>

	<div class="stack">
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
</style>
