<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { formatDate } from '#lib/league/format.ts';
	import { LIMITS } from '#lib/league/types.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import { toasts } from '#lib/ui/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** The next match day, which is what people are signing up for. */
	const nextDay = $derived(data.league.matchDays.find((day) => day.date >= data.today));

	const shareText = $derived(
		`¿Vas a jugar en ${data.league.tournament.name}${nextDay ? ` el ${formatDate(nextDay.date, 'long')}` : ''}? Regístrate aquí: ${page.url.href}`
	);

	/** Opens the phone's share sheet, or WhatsApp where there is none. */
	async function shareLink() {
		if (navigator.share) {
			try {
				await navigator.share({ text: shareText });
			} catch {
				// Closed without sharing.
			}
			return;
		}
		window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
	}

	async function copyList() {
		const text = data.registrations.map((entry) => entry.name).join('\n');
		try {
			await navigator.clipboard.writeText(text);
			toasts.show('Lista copiada');
		} catch {
			toasts.error('No se pudo copiar. Selecciona los nombres y cópialos a mano.');
		}
	}
</script>

<svelte:head>
	<title>Registro de jugadores · {data.league.tournament.name}</title>
</svelte:head>

<div class="stack">
	<section class="panel">
		<h2 class="panel-title">Registro de persona que va a jugar</h2>
		{#if nextDay}
			<p class="when">Para el {formatDate(nextDay.date, 'long')}</p>
		{/if}
		{#if data.league.tournament.registrationOpen}
			<p class="help">Aquí solo colocas tu nombre.</p>
			<p class="notice">
				<strong>
					Regístrate solo si vas a jugar y tocar la pelota. Si solo vas a arbitrar o a ver, no te
					registres.
				</strong>
			</p>
			<p class="notice">
				Recuerda: los equipos serán aleatorios, para que haya equilibrio y competitividad. Se
				anunciarán cuando se haga el sorteo.
			</p>
			<form
				class="stack"
				method="POST"
				action="?/register"
				use:enhance={withFeedback({ reset: true })}
			>
				<input
					class="input"
					name="name"
					maxlength={LIMITS.playerName}
					required
					autocomplete="name"
					placeholder="Nombre y apellido"
					aria-label="Tu nombre"
				/>
				<div class="btn-row">
					<button class="btn btn-primary">Registrarme</button>
				</div>
			</form>
		{:else}
			<p class="notice">
				<strong>La convocatoria está cerrada.</strong> Ya no se aceptan más registros.
			</p>
		{/if}
		{#if data.isOwner}
			<form method="POST" action="?/toggle" use:enhance={withFeedback()}>
				<input type="hidden" name="open" value={String(!data.league.tournament.registrationOpen)} />
				<button class="btn btn-sm">
					{data.league.tournament.registrationOpen ? 'Cerrar convocatoria' : 'Abrir convocatoria'}
				</button>
			</form>
		{/if}
	</section>

	{#if data.league.tournament.registrationOpen}
		<section class="panel">
			<h2 class="panel-title">¿Conoces a alguien que quiera jugar?</h2>
			<p class="help">Compártele este link para que se registre él mismo.</p>
			<div class="btn-row">
				<button type="button" class="btn" onclick={shareLink}>Compartir link</button>
			</div>
		</section>
	{/if}

	<section class="panel">
		<div class="panel-head">
			<h2 class="panel-title">Lista de registrados ({data.registrations.length})</h2>
			{#if data.isAdmin && data.registrations.length > 0}
				<div class="btn-row">
					<button type="button" class="btn btn-sm" onclick={copyList}>Copiar lista</button>
					{#if data.isOwner}
						<form method="POST" action="?/clear" use:enhance={withFeedback()}>
							<button
								class="btn btn-sm btn-danger"
								onclick={(event) => {
									if (!confirm('¿Borrar toda la lista de registrados?')) event.preventDefault();
								}}
							>
								Borrar lista
							</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
		{#if data.registrations.length === 0}
			<div class="empty">Todavía no se ha registrado nadie.</div>
		{:else}
			<ol class="names">
				{#each data.registrations as entry (entry.id)}
					<li>
						<span>{entry.name}</span>
						{#if data.isAdmin}
							<form method="POST" action="?/remove" use:enhance={withFeedback()}>
								<input type="hidden" name="id" value={entry.id} />
								<button class="icon-btn danger" aria-label="Quitar a {entry.name}">
									<Icon name="trash" />
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</section>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.when {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--color-accent-text);
	}

	.names {
		margin: 0;
		padding-left: 1.6em;
	}

	.names li {
		padding: 6px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.names li:last-child {
		border-bottom: 0;
	}

	.names li > * {
		vertical-align: middle;
	}

	.names form {
		display: inline;
		float: right;
	}
</style>
