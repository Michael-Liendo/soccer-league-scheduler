<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		title: string;
		subtitle?: string;
		wide?: boolean;
		/** Colour of the stripe above the title, used for team sheets. */
		accent?: string;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		open = $bindable(),
		title,
		subtitle,
		wide = false,
		accent,
		children,
		footer
	}: Props = $props();

	const titleId = $props.id();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialog) open = false;
	}
</script>

<dialog
	bind:this={dialog}
	class:wide
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={closeOnBackdrop}
>
	{#if open}
		<header class="head" class:accented={accent} style:--accent={accent}>
			<div>
				<h2 id={titleId}>{title}</h2>
				{#if subtitle}<p class="help">{subtitle}</p>{/if}
			</div>
			<button type="button" class="icon-btn" aria-label="Cerrar" onclick={() => (open = false)}>
				<Icon name="close" size={18} />
			</button>
		</header>
		<div class="body">{@render children()}</div>
		{#if footer}
			<footer class="foot">{@render footer()}</footer>
		{/if}
	{/if}
</dialog>

<style>
	dialog {
		width: min(560px, calc(100vw - 24px));
		max-height: calc(
			100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
		);
		padding: 0;
		border: 0;
		border-radius: 16px;
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 24px 70px rgb(0 0 0 / 0.4);
		overflow: hidden;
	}

	dialog.wide {
		width: min(680px, calc(100vw - 24px));
	}

	dialog[open] {
		display: flex;
		flex-direction: column;
	}

	dialog::backdrop {
		background: rgb(4 14 9 / 0.62);
	}

	.head {
		display: flex;
		flex: none;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		padding: 16px 18px;
		border-bottom: 1px solid var(--color-border);
	}

	.head.accented {
		border-top: 6px solid var(--accent);
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.55rem;
		line-height: 1.05;
	}

	.body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: 16px;
		min-height: 0;
		padding: 16px 18px;
		overflow-y: auto;
	}

	.foot {
		display: flex;
		flex: none;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 18px;
		border-top: 1px solid var(--color-border);
	}
</style>
