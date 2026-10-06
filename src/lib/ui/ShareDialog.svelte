<script lang="ts">
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import { toasts } from './toast.svelte.ts';

	interface Props {
		open: boolean;
		title: string;
		/** Message to share, written with WhatsApp's *bold* marks. */
		text: string;
	}

	let { open = $bindable(), title, text }: Props = $props();

	const whatsappUrl = $derived(`https://wa.me/?text=${encodeURIComponent(text)}`);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			toasts.show('Texto copiado');
		} catch {
			toasts.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
		}
	}
</script>

<Dialog bind:open {title}>
	<label class="field">
		<span class="field-label">Texto para compartir</span>
		<textarea class="input" rows="9" readonly value={text}></textarea>
	</label>
	{#snippet footer()}
		<button type="button" class="btn" onclick={copy}><Icon name="copy" /> Copiar texto</button>
		<a class="btn btn-primary" href={whatsappUrl} target="_blank" rel="noopener external">
			Enviar por WhatsApp
		</a>
	{/snippet}
</Dialog>

<style>
	textarea {
		min-height: 160px;
		line-height: 1.4;
		resize: vertical;
	}
</style>
