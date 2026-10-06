<script lang="ts">
	import MatchList from '#lib/ui/MatchList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data.league.matches.length === 0}
	<div class="empty">
		Todavía no hay calendario. Vuelve pronto: aquí aparecerán los partidos de cada jornada.
	</div>
{:else}
	<MatchList league={data.league} today={data.today} />
{/if}
