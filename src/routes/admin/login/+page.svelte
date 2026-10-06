<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Masthead from '#lib/ui/Masthead.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let showCode = $state(false);
</script>

<svelte:head>
	<title>{data.league.tournament.name} · Administración</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Masthead title={data.league.tournament.name} kicker="Administración" />

<main class="container page">
	<section class="panel login">
		{#if data.enabled}
			<h2 class="panel-title">Entrar al panel</h2>
			<p class="help">
				Solo quien tenga el código puede crear equipos, armar el calendario y cargar resultados.
			</p>
			{#if form?.error}<p class="warn" role="alert">{form.error}</p>{/if}
			<form class="stack" method="POST" use:enhance>
				<label class="field">
					<span class="field-label">Código de acceso</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="input"
						name="code"
						type={showCode ? 'text' : 'password'}
						autocomplete="current-password"
						required
						autofocus
					/>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={showCode} />
					<span>Mostrar código</span>
				</label>
				<div class="btn-row">
					<button class="btn btn-primary">Entrar</button>
					<a class="btn" href={resolve('')}>Ver la vista pública</a>
				</div>
			</form>
		{:else}
			<h2 class="panel-title">Panel desactivado</h2>
			<p>
				Falta definir el código de acceso. Agrega la variable de entorno
				<code>ADMIN_CODE</code> en el servidor (mínimo 6 caracteres) y reinicia la aplicación.
			</p>
			<div class="btn-row">
				<a class="btn" href={resolve('')}>Ver la vista pública</a>
			</div>
		{/if}
	</section>
</main>

<style>
	.login {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 460px;
		margin-inline: auto;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 500;
		cursor: pointer;
	}

	.toggle input {
		width: 20px;
		height: 20px;
		accent-color: var(--color-turf);
	}

	code {
		padding: 1px 6px;
		border-radius: 6px;
		background: var(--color-surface-alt);
		font-size: 0.9em;
	}
</style>
