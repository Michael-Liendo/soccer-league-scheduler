<script lang="ts">
	import { resolve } from '$app/paths';
	import { leagueKicker, leaguePhase } from '#lib/league/view.ts';
	import Masthead from '#lib/ui/Masthead.svelte';
	import TabNav, { type TabItem } from '#lib/ui/TabNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const tabs: TabItem[] = [
		{ path: 'partidos', label: 'Partidos' },
		{ path: 'equipos', label: 'Equipos' }
	];
</script>

<svelte:head>
	<title>{data.league.tournament.name}</title>
	<meta
		name="description"
		content="Calendario, equipos y resultados de {data.league.tournament.name}."
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
