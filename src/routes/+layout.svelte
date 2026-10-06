<script lang="ts">
	import '@fontsource/barlow/latin-400.css';
	import '@fontsource/barlow/latin-500.css';
	import '@fontsource/barlow/latin-600.css';
	import '@fontsource/barlow/latin-700.css';
	import '@fontsource/barlow-condensed/latin-600.css';
	import '@fontsource/barlow-condensed/latin-700.css';
	import '@fontsource/barlow-condensed/latin-800.css';
	import '../app.css';
	import { asset } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
	import Toaster from '#lib/ui/Toaster.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href={asset('apple-touch-icon.png')} />
</svelte:head>

{@render children()}
<Toaster />
