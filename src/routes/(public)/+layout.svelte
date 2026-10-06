<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { leagueKicker, leaguePhase } from '#lib/league/view.ts';
	import Masthead from '#lib/ui/Masthead.svelte';
	import TabNav, { type TabItem } from '#lib/ui/TabNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const tabs: TabItem[] = [
		{ path: '', label: 'Posiciones' },
		{ path: 'partidos', label: 'Partidos' },
		{ path: 'estadisticas', label: 'Estadísticas' },
		{ path: 'equipos', label: 'Equipos' }
	];

	const POLL_INTERVAL_MS = 20_000;

	// Keeps the page current while a match is being played: when the league changes on the
	// server, the data is loaded again without touching what the visitor is looking at.
	$effect(() => {
		let stopped = false;

		async function checkForUpdates() {
			if (document.hidden) return;
			try {
				const response = await fetch(resolve('version'));
				if (!response.ok) return;
				const { updatedAt } = await response.json();
				if (!stopped && updatedAt !== data.league.tournament.updatedAt) await refreshAll();
			} catch {
				// Offline or a hiccup on the server: the next check will catch up.
			}
		}

		const timer = setInterval(checkForUpdates, POLL_INTERVAL_MS);
		document.addEventListener('visibilitychange', checkForUpdates);
		return () => {
			stopped = true;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', checkForUpdates);
		};
	});
</script>

<svelte:head>
	<title>{data.league.tournament.name}</title>
	<meta
		name="description"
		content="Posiciones, calendario, resultados y goleadores de {data.league.tournament.name}."
	/>
</svelte:head>

<Masthead
	title={data.league.tournament.name}
	kicker={leagueKicker(data.league)}
	subtitle={leaguePhase(data.league, data.today)}
>
	{#snippet tools()}
		{#if data.isAdmin}
			<a class="btn btn-sm btn-on-turf" href={resolve('admin')}>Ir al panel</a>
		{/if}
	{/snippet}
</Masthead>
<TabNav items={tabs} label="Secciones" />
<main class="container page">
	{@render children()}
</main>
