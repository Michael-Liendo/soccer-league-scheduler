<script lang="ts" module>
	const PATHS = {
		alert: 'M12 4.5 21 20H3zM12 10v4.5M12 17.2v.3',
		ball: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8.3l3.8 2.8-1.4 4.4H9.6l-1.4-4.4zM12 8.3V3.2M15.8 11.1l4.7-1.6M14.4 15.5l2.8 3.9M9.6 15.5l-2.8 3.9M8.2 11.1 3.5 9.5',
		calendar: 'M4 6.5h16V20H4zM4 10.5h16M8 3.5v4M16 3.5v4',
		check: 'm5 12.5 4.5 4.5L19 7.5',
		clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
		close: 'm6 6 12 12M18 6 6 18',
		copy: 'M9 9h10.5v11.5H9zM5 15V4h10',
		external: 'M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5',
		logout: 'M10 5H5.5v14H10M15 8l4 4-4 4M19 12H9.5',
		pencil: 'm4 20 4-1L19.5 7.5l-3-3L5 16zM14.5 6.5l3 3',
		pin: 'M12 21s7-6.3 7-11.2a7 7 0 1 0-14 0C5 14.7 12 21 12 21zM12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
		plus: 'M12 5v14M5 12h14',
		shuffle:
			'M3 7h3.2c2 0 3.3 1 4.4 2.7l2.6 4.1c1.1 1.7 2.4 2.7 4.4 2.7H21M18 13.5l3 3-3 3M3 16.5h3.2c1.2 0 2.2-.4 3-1.1M21 7h-3.4c-1.2 0-2.2.4-3 1.1M18 4l3 3-3 3',
		star: 'm12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z',
		trash: 'M4 7h16M9.5 7V4h5v3M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5',
		users:
			'M16 19.5v-1.2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1.2M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19.5v-1.2a4 4 0 0 0-3-3.8M15.5 3.7a3.5 3.5 0 0 1 0 6.6'
	} as const;

	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: number;
	}

	let { name, size = 16 }: Props = $props();
</script>

<svg
	class="icon"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={PATHS[name]} />
</svg>

<style>
	.icon {
		flex: none;
		vertical-align: -3px;
	}
</style>
