/**
 * The current time, ticking once a second in the browser and aligned with the server's clock,
 * so a match timer shows the same on every phone. Call it while a component is being set up.
 */
export function createTicker(serverNow: () => number) {
	let now = $state(serverNow());

	$effect(() => {
		// Read again whenever fresh data arrives, to cancel out any drift of this device's clock.
		const offset = Date.now() - serverNow();
		now = serverNow();
		const timer = setInterval(() => (now = Date.now() - offset), 1000);
		return () => clearInterval(timer);
	});

	return {
		get now() {
			return now;
		}
	};
}
