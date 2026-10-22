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
		const tick = () => (now = Date.now() - offset);
		const timer = setInterval(tick, 1000);
		// Phones pause the page while the screen is off; catch up the moment it is back.
		document.addEventListener('visibilitychange', tick);
		window.addEventListener('pageshow', tick);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', tick);
			window.removeEventListener('pageshow', tick);
		};
	});

	return {
		get now() {
			return now;
		}
	};
}
