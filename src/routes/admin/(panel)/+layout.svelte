<script lang="ts">
	import { resolve } from '$app/paths';
	import { leaguePhase } from '#lib/league/view.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import Masthead from '#lib/ui/Masthead.svelte';
	import TabNav, { type TabItem } from '#lib/ui/TabNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Settings and access codes belong to the owner; helpers do not get that tab.
	const tabs = $derived<TabItem[]>([
		{ path: 'admin/equipos', label: 'Equipos' },
		{ path: 'admin/calendario', label: 'Calendario' },
		{ path: 'admin/partidos', label: 'Partidos' },
		...(data.isOwner ? [{ path: 'admin/configuracion', label: 'Configuración' } as TabItem] : [])
	]);
</script>

<svelte:head>
	<title>{data.league.tournament.name} · Administración</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Masthead
	title={data.league.tournament.name}
	kicker={data.isOwner ? 'Administración' : `Ayudante · ${data.sessionLabel}`}
	subtitle={leaguePhase(data.league, data.today)}
>
	{#snippet tools()}
		<a class="btn btn-sm btn-on-brand" href={resolve('')} target="_blank" rel="noopener">
			<Icon name="external" /> Ver vista pública
		</a>
		<form method="POST" action={resolve('admin/logout')}>
			<button class="btn btn-sm btn-on-brand"><Icon name="logout" /> Cerrar sesión</button>
		</form>
	{/snippet}
</Masthead>
<TabNav items={tabs} label="Secciones del panel" />
<main class="container page">
	{@render children()}
</main>
