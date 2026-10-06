<script lang="ts" module>
	import type { Path } from '$app/types';

	export interface TabItem {
		/** Path of the page, without the leading slash. */
		path: Path;
		label: string;
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	interface Props {
		items: TabItem[];
		label: string;
	}

	let { items, label }: Props = $props();

	const currentPath = $derived(page.url.pathname.replace(/\/+$/, ''));

	function isCurrent(item: TabItem): boolean {
		return currentPath === (item.path === '' ? '' : `/${item.path}`);
	}
</script>

<nav class="tabs" aria-label={label}>
	<div class="container list">
		{#each items as item (item.path)}
			<a class="tab" href={resolve(item.path)} aria-current={isCurrent(item) ? 'page' : undefined}>
				{item.label}
			</a>
		{/each}
	</div>
</nav>

<style>
	.tabs {
		position: sticky;
		top: env(safe-area-inset-top, 0px);
		z-index: 20;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.list {
		display: flex;
		gap: 2px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.list::-webkit-scrollbar {
		display: none;
	}

	.tab {
		padding: 14px 12px 11px;
		border-bottom: 3px solid transparent;
		color: var(--color-text-muted);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.18rem;
		text-decoration: none;
		white-space: nowrap;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab[aria-current='page'] {
		border-bottom-color: var(--color-accent);
		color: var(--color-text);
	}
</style>
