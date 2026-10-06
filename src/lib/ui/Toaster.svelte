<script lang="ts">
	import { toasts } from './toast.svelte.ts';

	let container: HTMLDivElement | undefined = $state();

	// Modal dialogs live in the browser's top layer, above everything else. Showing the toasts as
	// a popover puts them there too, and re-showing moves them in front of an open dialog.
	$effect(() => {
		if (!container?.showPopover) return;
		if (toasts.items.length === 0) {
			if (container.matches(':popover-open')) container.hidePopover();
			return;
		}
		if (container.matches(':popover-open')) container.hidePopover();
		container.showPopover();
	});
</script>

<div bind:this={container} class="toaster" popover="manual" role="status" aria-live="polite">
	{#each toasts.items as toast (toast.id)}
		<p class="toast" class:error={toast.kind === 'error'}>{toast.text}</p>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		inset: auto 0 calc(18px + env(safe-area-inset-bottom, 0px)) 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: auto;
		margin: 0;
		padding: 0 16px;
		border: 0;
		background: none;
		overflow: visible;
		pointer-events: none;
	}

	.toast {
		max-width: min(480px, 100%);
		padding: 10px 16px;
		border-radius: var(--radius-m);
		background: var(--color-text);
		color: var(--color-bg);
		font-size: 0.9rem;
		font-weight: 600;
		text-align: center;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.25);
		animation: toast-in 0.2s ease-out;
	}

	.toast.error {
		background: var(--color-loss);
		color: #fff;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
</style>
