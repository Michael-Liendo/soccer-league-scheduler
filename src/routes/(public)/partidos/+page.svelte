<script lang="ts">
	import { page } from '$app/state';
	import { formatDate, formatTime } from '#lib/league/format.ts';
	import type { Match } from '#lib/league/types.ts';
	import { eventsByPlayer, teamsById, venueOf } from '#lib/league/view.ts';
	import MatchList from '#lib/ui/MatchList.svelte';
	import ShareDialog from '#lib/ui/ShareDialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let sharedId = $state<number | null>(null);

	const league = $derived(data.league);
	const teams = $derived(teamsById(league.teams));
	const shared = $derived(league.matches.find((match) => match.id === sharedId));

	function scorers(match: Match, teamId: number): string {
		return eventsByPlayer(match, teams.get(teamId))
			.filter((player) => player.goals > 0)
			.map((player) => (player.goals > 1 ? `${player.name} ×${player.goals}` : player.name))
			.join(', ');
	}

	function shareText(match: Match): string {
		const home = teams.get(match.homeTeamId)?.name ?? '';
		const away = teams.get(match.awayTeamId)?.name ?? '';
		const day = league.matchDays.find((candidate) => candidate.id === match.matchDayId);
		const lines = [
			`⚽ *${league.tournament.name}*`,
			`Jornada ${day?.number ?? ''}${match.status === 'live' ? ' (en vivo)' : ''}`,
			'',
			`*${home} ${match.homeScore} - ${match.awayScore} ${away}*`
		];

		const homeScorers = scorers(match, match.homeTeamId);
		const awayScorers = scorers(match, match.awayTeamId);
		if (homeScorers || awayScorers) lines.push('');
		if (homeScorers) lines.push(`Goles de ${home}: ${homeScorers}`);
		if (awayScorers) lines.push(`Goles de ${away}: ${awayScorers}`);

		const where = [
			day ? formatDate(day.date, 'medium') : '',
			match.time ? formatTime(match.time) : '',
			venueOf(match, league)
		].filter(Boolean);
		if (where.length > 0) lines.push('', `📍 ${where.join(', ')}`);

		lines.push('', `${page.url.origin}/partidos`);
		return lines.join('\n');
	}
</script>

{#if league.matches.length === 0}
	<div class="empty">
		Todavía no hay calendario. Vuelve pronto: aquí aparecerán los partidos de cada jornada.
	</div>
{:else}
	<MatchList {league} today={data.today} hasActions={(match) => match.status !== 'pending'}>
		{#snippet actions(match: Match)}
			<button type="button" class="btn btn-sm btn-quiet" onclick={() => (sharedId = match.id)}>
				Compartir resultado
			</button>
		{/snippet}
	</MatchList>
{/if}

<ShareDialog
	bind:open={() => shared !== undefined, (open) => !open && (sharedId = null)}
	title="Compartir resultado"
	text={shared ? shareText(shared) : ''}
/>
