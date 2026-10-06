export interface RateLimiterOptions {
	/** Failures allowed within the window before the key is locked out. */
	maxFailures: number;
	windowMs: number;
}

interface Entry {
	failures: number;
	resetAt: number;
}

/**
 * Counts failed attempts per key (an IP address, for instance) in memory. Good enough for a
 * single server process, which is how this app runs.
 */
export function createRateLimiter({ maxFailures, windowMs }: RateLimiterOptions) {
	const entries = new Map<string, Entry>();

	function current(key: string, now: number): Entry | undefined {
		const entry = entries.get(key);
		if (entry && entry.resetAt <= now) {
			entries.delete(key);
			return undefined;
		}
		return entry;
	}

	return {
		isLocked(key: string, now: number = Date.now()): boolean {
			return (current(key, now)?.failures ?? 0) >= maxFailures;
		},
		recordFailure(key: string, now: number = Date.now()): void {
			const entry = current(key, now);
			if (entry) entry.failures += 1;
			else entries.set(key, { failures: 1, resetAt: now + windowMs });
			// Forget expired keys now and then so the map cannot grow without bound.
			if (entries.size > 1000) {
				for (const [other, value] of entries) {
					if (value.resetAt <= now) entries.delete(other);
				}
			}
		},
		reset(key: string): void {
			entries.delete(key);
		}
	};
}
