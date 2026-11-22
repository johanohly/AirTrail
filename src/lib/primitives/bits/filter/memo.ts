export function memo<T1, TResult>(
	getDeps: () => readonly [T1],
	compute: (deps: readonly [T1]) => TResult,
	options: { key: string }
): () => TResult;
export function memo<T1, T2, TResult>(
	getDeps: () => readonly [T1, T2],
	compute: (deps: readonly [T1, T2]) => TResult,
	options: { key: string }
): () => TResult;
export function memo<T1, T2, T3, TResult>(
	getDeps: () => readonly [T1, T2, T3],
	compute: (deps: readonly [T1, T2, T3]) => TResult,
	options: { key: string }
): () => TResult;
export function memo<TDeps extends readonly any[], TResult>(
	getDeps: () => TDeps,
	compute: (deps: TDeps) => TResult,
	options: { key: string }
): () => TResult;
export function memo<TDeps extends readonly any[], TResult>(
	getDeps: () => TDeps,
	compute: (deps: TDeps) => TResult,
	_options: { key: string }
): () => TResult {
	let prevDeps: TDeps | undefined;
	let cachedResult: TResult | undefined;

	return () => {
		const deps = getDeps();
		if (!prevDeps || !shallowEqual(prevDeps, deps)) {
			cachedResult = compute(deps);
			prevDeps = deps;
		}
		return cachedResult!;
	};
}

function shallowEqual<T>(arr1: readonly T[], arr2: readonly T[]): boolean {
	if (arr1 === arr2) return true;
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}
