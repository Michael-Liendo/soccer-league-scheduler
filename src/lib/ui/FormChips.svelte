<script lang="ts">
	import { FORM_LABELS } from '#lib/league/labels.ts';
	import type { FormResult } from '#lib/league/standings.ts';

	interface Props {
		/** Results oldest first; only the last five are shown. */
		form: FormResult[];
	}

	let { form }: Props = $props();

	const recent = $derived(form.slice(-5));
</script>

{#if recent.length === 0}
	<span class="muted">–</span>
{:else}
	<span class="chips">
		{#each recent as result, index (index)}
			<span class={['chip', result]} title={FORM_LABELS[result].title}>
				{FORM_LABELS[result].letter}
			</span>
		{/each}
	</span>
{/if}

<style>
	.chips {
		display: inline-flex;
		gap: 3px;
	}

	.chip {
		display: inline-grid;
		place-items: center;
		width: 21px;
		height: 21px;
		border-radius: 5px;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 700;
	}

	.chip.W {
		background: var(--color-win);
	}

	.chip.D {
		background: var(--color-draw);
	}

	.chip.L {
		background: var(--color-loss);
	}
</style>
