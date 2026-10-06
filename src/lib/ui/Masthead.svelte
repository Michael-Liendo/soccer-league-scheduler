<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		kicker?: string;
		subtitle?: string;
		tools?: Snippet;
	}

	let { title, kicker, subtitle, tools }: Props = $props();
</script>

<header class="masthead">
	<svg class="pitch" viewBox="0 0 1000 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
		<g fill="none" stroke="currentColor" stroke-width="2">
			<rect x="12" y="12" width="976" height="196" />
			<path d="M500 12v196" />
			<circle cx="500" cy="110" r="58" />
			<circle cx="500" cy="110" r="3" fill="currentColor" />
			<rect x="12" y="52" width="112" height="116" />
			<rect x="12" y="84" width="44" height="52" />
			<path d="M124 82a34 34 0 0 1 0 56" />
			<rect x="876" y="52" width="112" height="116" />
			<rect x="944" y="84" width="44" height="52" />
			<path d="M876 82a34 34 0 0 0 0 56" />
		</g>
	</svg>
	<div class="container inner">
		<div class="titles">
			{#if kicker}
				<p class="kicker">
					<svg class="flag" viewBox="0 0 30 20" aria-hidden="true">
						<rect width="30" height="20" fill="var(--color-flag-red)" />
						<rect width="30" height="13.4" fill="var(--color-flag-blue)" />
						<rect width="30" height="6.7" fill="var(--color-flag-yellow)" />
						<g fill="#fff">
							<circle cx="9.2" cy="11.6" r="0.75" />
							<circle cx="10.6" cy="10" r="0.75" />
							<circle cx="12.4" cy="8.9" r="0.75" />
							<circle cx="14.1" cy="8.4" r="0.75" />
							<circle cx="15.9" cy="8.4" r="0.75" />
							<circle cx="17.6" cy="8.9" r="0.75" />
							<circle cx="19.4" cy="10" r="0.75" />
							<circle cx="20.8" cy="11.6" r="0.75" />
						</g>
					</svg>
					{kicker}
				</p>
			{/if}
			<h1>{title}</h1>
			{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
		</div>
		{#if tools}
			<div class="tools">{@render tools()}</div>
		{/if}
	</div>
	<div class="ribbon" aria-hidden="true"></div>
</header>

<style>
	.masthead {
		position: relative;
		overflow: hidden;
		padding-top: env(safe-area-inset-top, 0px);
		background:
			repeating-linear-gradient(90deg, transparent 0 90px, var(--color-turf-stripe) 90px 180px),
			var(--color-turf);
		color: var(--color-on-turf);
	}

	.pitch {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0.15;
		pointer-events: none;
	}

	.pitch :global(*) {
		vector-effect: non-scaling-stroke;
	}

	.inner {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 14px 24px;
		padding-top: 28px;
		padding-bottom: 22px;
	}

	.titles {
		min-width: 0;
	}

	.kicker {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 8px;
		color: var(--color-accent);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.05rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2.5rem, 7.5vw, 4.4rem);
		line-height: 0.9;
		letter-spacing: -0.01em;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}

	.subtitle {
		margin-top: 10px;
		color: var(--color-on-turf-muted);
		font-weight: 500;
	}

	.flag {
		flex: none;
		width: 24px;
		height: 16px;
		border-radius: 3px;
		box-shadow: 0 0 0 1px rgb(255 255 255 / 0.25);
	}

	/* Yellow, blue and red bands, as on the flag. */
	.ribbon {
		position: relative;
		height: 6px;
		background: linear-gradient(
			var(--color-flag-yellow) 0 33.4%,
			var(--color-flag-blue) 33.4% 66.7%,
			var(--color-flag-red) 66.7%
		);
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
