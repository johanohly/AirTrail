import { getValidNumber } from "./helpers.js";

export function intersection<T>(a: T[], b: T[]): T[] {
	return a.filter((x) => b.includes(x));
}

function deepHash(value: any, cache = new WeakMap<object, string>()): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	const type = typeof value;

	if (type === "number" || type === "boolean" || type === "string" || type === "bigint") {
		return `${type}:${value.toString()}`;
	}

	if (type === "function") {
		return `function:${value.toString()}`;
	}

	if (type === "object") {
		if (cache.has(value)) return cache.get(value)!;

		let hash: string;
		if (Array.isArray(value)) {
			hash = `array:[${value.map((v) => deepHash(v, cache)).join(",")}]`;
		} else if (value instanceof Date) {
			hash = `date:${value.getTime()}`;
		} else {
			const keys = Object.keys(value).sort();
			const props = keys.map((k) => `${k}:${deepHash(value[k], cache)}`).join(",");
			hash = `object:{${props}}`;
		}

		cache.set(value, hash);
		return hash;
	}

	return `${type}:${value.toString()}`;
}

function deepEqual(a: any, b: any): boolean {
	if (a === b) return true;
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
	if (typeof a !== typeof b) return false;
	if (a === null || b === null || a === undefined || b === undefined) return false;

	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		return a.every((value, index) => deepEqual(value, b[index]));
	}

	if (typeof a === "object") {
		if (typeof b !== "object") return false;
		const aKeys = Object.keys(a).sort();
		const bKeys = Object.keys(b).sort();
		if (aKeys.length !== bKeys.length) return false;
		for (let i = 0; i < aKeys.length; i++) {
			const aKey = aKeys[i]!;
			const bKey = bKeys[i]!;
			if (aKey !== bKey || !deepEqual(a[aKey], b[bKey])) return false;
		}
		return true;
	}

	return false;
}

export function uniq<T>(arr: T[]): T[] {
	const seen = new Map<string, T[]>();
	const result: T[] = [];

	for (const item of arr) {
		const hash = deepHash(item);
		const itemsWithHash = seen.get(hash);

		if (!itemsWithHash) {
			seen.set(hash, [item]);
			result.push(item);
			continue;
		}

		if (!itemsWithHash.some((existing) => deepEqual(existing, item))) {
			itemsWithHash.push(item);
			result.push(item);
		}
	}

	return result;
}

export function take<T>(a: T[], n: number): T[] {
	return a.slice(0, n);
}

export function flatten<T>(a: T[][]): T[] {
	return a.flat();
}

export function addUniq<T>(arr: T[], values: T[]): T[] {
	return uniq([...arr, ...values]);
}

export function removeUniq<T>(arr: T[], values: T[]): T[] {
	return arr.filter((v) => !values.includes(v));
}

export function isAnyOf<T>(value: T, values: T[]): boolean {
	return values.includes(value);
}

function getValidBigInt(value: any): bigint | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value !== "bigint") return undefined;
	return value;
}

export function max(values: readonly number[]): number;
export function max(values: readonly bigint[]): bigint;
export function max(values: readonly number[] | readonly bigint[]): number | bigint {
	let found = false;
	let isNumberArray = false;

	for (const value of values) {
		if (getValidNumber(value) !== undefined) {
			isNumberArray = true;
			break;
		}
		if (getValidBigInt(value) !== undefined) break;
	}

	if (isNumberArray) {
		let m = Number.NEGATIVE_INFINITY;
		for (const value of values) {
			const v = getValidNumber(value);
			if (v !== undefined) {
				if (v > m) m = v;
				found = true;
			}
		}
		return found ? m : Number.NEGATIVE_INFINITY;
	}

	let m: bigint | number = Number.NEGATIVE_INFINITY;
	for (const value of values) {
		const v = getValidBigInt(value);
		if (v !== undefined) {
			if (!found) {
				m = v;
				found = true;
			} else if (typeof m === "bigint" && v > m) {
				m = v;
			}
		}
	}
	return found ? m : Number.NEGATIVE_INFINITY;
}

export function min(values: readonly number[]): number;
export function min(values: readonly bigint[]): bigint;
export function min(values: readonly number[] | readonly bigint[]): number | bigint {
	let found = false;
	let isNumberArray = false;

	for (const value of values) {
		if (getValidNumber(value) !== undefined) {
			isNumberArray = true;
			break;
		}
		if (getValidBigInt(value) !== undefined) break;
	}

	if (isNumberArray) {
		let m = Number.POSITIVE_INFINITY;
		for (const value of values) {
			const v = getValidNumber(value);
			if (v !== undefined) {
				if (v < m) m = v;
				found = true;
			}
		}
		return found ? m : Number.POSITIVE_INFINITY;
	}

	let m: bigint | number = Number.POSITIVE_INFINITY;
	for (const value of values) {
		const v = getValidBigInt(value);
		if (v !== undefined) {
			if (!found) {
				m = v;
				found = true;
			} else if (typeof m === "bigint" && v < m) {
				m = v;
			}
		}
	}
	return found ? m : Number.POSITIVE_INFINITY;
}

export function minMax(values: readonly number[]): [number, number];
export function minMax(values: readonly bigint[]): [bigint, bigint];
export function minMax(
	values: readonly number[] | readonly bigint[]
): [number, number] | [bigint, bigint] {
	let found = false;
	let isNumberArray = false;

	for (const value of values) {
		if (getValidNumber(value) !== undefined) {
			isNumberArray = true;
			break;
		}
		if (getValidBigInt(value) !== undefined) break;
	}

	if (isNumberArray) {
		let minVal = Number.POSITIVE_INFINITY;
		let maxVal = Number.NEGATIVE_INFINITY;
		for (const value of values) {
			const v = getValidNumber(value);
			if (v !== undefined) {
				if (v < minVal) minVal = v;
				if (v > maxVal) maxVal = v;
				found = true;
			}
		}
		return found
			? [minVal, maxVal]
			: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
	}

	let minVal: bigint | number = Number.POSITIVE_INFINITY;
	let maxVal: bigint | number = Number.NEGATIVE_INFINITY;
	for (const value of values) {
		const v = getValidBigInt(value);
		if (v !== undefined) {
			if (!found) {
				minVal = v;
				maxVal = v;
				found = true;
			} else {
				if (typeof minVal === "bigint" && v < minVal) minVal = v;
				if (typeof maxVal === "bigint" && v > maxVal) maxVal = v;
			}
		}
	}

	return found
		? [minVal as bigint, maxVal as bigint]
		: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
}
