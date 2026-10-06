/** A source of random numbers in `[0, 1)`, such as `Math.random`. Tests pass a seeded one. */
export type Rng = () => number;

/** A shuffled copy of `items` (Fisher–Yates). */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
