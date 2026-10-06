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
	<!-- Eight stars in an arc, as on the flag. -->
	<svg class="stars" viewBox="0 0 400 220" aria-hidden="true">
		<path
			fill="currentColor"
			d="M34.9 144.2L46.8 145.9L52.9 135.4L54.9 147.3L66.7 149.8L56.1 155.5L57.4 167.5L48.7 159.1L37.7 164.0L43.0 153.2zM69.4 98.1L80.3 103.4L89.2 95.3L87.6 107.2L98.1 113.2L86.2 115.3L83.7 127.1L78.0 116.5L66.1 117.8L74.4 109.1zM116.4 64.8L125.1 73.1L136.1 68.0L130.9 78.9L139.0 87.8L127.1 86.2L121.2 96.7L119.0 84.9L107.1 82.5L117.7 76.7zM171.2 47.2L177.0 57.8L189.0 56.3L180.7 65.1L185.8 76.1L174.9 70.9L166.1 79.2L167.6 67.2L157.0 61.3L168.9 59.1zM228.8 47.2L231.1 59.1L243.0 61.3L232.4 67.2L233.9 79.2L225.1 70.9L214.2 76.1L219.3 65.1L211.0 56.3L223.0 57.8zM283.6 64.8L282.3 76.7L292.9 82.5L281.0 84.9L278.8 96.7L272.9 86.2L261.0 87.8L269.1 78.9L263.9 68.0L274.9 73.1zM330.6 98.1L325.6 109.1L333.9 117.8L322.0 116.5L316.3 127.1L313.8 115.3L301.9 113.2L312.4 107.2L310.8 95.3L319.7 103.4zM365.1 144.2L357.0 153.2L362.3 164.0L351.3 159.1L342.6 167.5L343.9 155.5L333.3 149.8L345.1 147.3L347.1 135.4L353.2 145.9z"
		/>
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
		background: linear-gradient(120deg, var(--color-brand) 30%, var(--color-brand-deep));
		color: var(--color-on-brand);
	}

	.stars {
		position: absolute;
		right: max(0px, calc((100% - var(--page-width)) / 2));
		bottom: 0;
		width: min(400px, 78%);
		height: auto;
		color: var(--color-flag-yellow);
		opacity: 0.2;
		pointer-events: none;
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
		color: var(--color-on-brand-muted);
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
