<script lang="ts">
	import { enhance } from '$app/forms';
	import { LIMITS } from '#lib/league/types.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import { withFeedback } from '#lib/ui/forms.ts';
	import { toasts } from '#lib/ui/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** One field per person being signed up; the keys only keep the list stable. */
	let fields = $state([{ key: 0 }]);
	let nextKey = 1;

	function addField() {
		fields.push({ key: nextKey++ });
	}

	function removeField(key: number) {
		fields = fields.filter((field) => field.key !== key);
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
		<p class="help">
			Aquí solo colocas el nombre de la persona que va a jugar. Si van a jugar más personas, toca
			“Agregar otra persona” y te saldrá otro espacio.
		</p>
		<form
			class="stack"
			method="POST"
			action="?/register"
			use:enhance={withFeedback({ reset: true, onSuccess: () => (fields = [{ key: nextKey++ }]) })}
		>
			{#each fields as field, index (field.key)}
				<div class="row">
					<input
						class="input"
						name="name"
						maxlength={LIMITS.playerName}
						required={index === 0}
						autocomplete="name"
						placeholder="Nombre y apellido"
						aria-label="Nombre de la persona {index + 1}"
					/>
					{#if fields.length > 1}
						<button
							type="button"
							class="icon-btn"
							aria-label="Quitar este espacio"
							onclick={() => removeField(field.key)}
						>
							<Icon name="trash" />
						</button>
					{/if}
				</div>
			{/each}
			<div class="btn-row">
				<button type="button" class="btn" onclick={addField} disabled={fields.length >= 10}>
					<Icon name="plus" /> Agregar otra persona
				</button>
				<button class="btn btn-primary">Registrarme</button>
			</div>
		</form>
	</section>

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

	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 8px;
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
