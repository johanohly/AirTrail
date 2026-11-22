import type {
	ColumnOption,
	OrderDirection,
	TBuiltInOrderFn,
	TBuiltInOrderFnName,
	TCustomOrderFn,
	TOrderFnArg,
	TOrderFns,
} from "./types.js";

function count(a: ColumnOption, b: ColumnOption, direction: OrderDirection) {
	const x = a.count ?? 0;
	const y = b.count ?? 0;
	return direction === "asc" ? x - y : y - x;
}

function label(a: ColumnOption, b: ColumnOption, direction: OrderDirection) {
	const x = a.label.toLowerCase();
	const y = b.label.toLowerCase();
	return direction === "asc" ? x.localeCompare(y) : y.localeCompare(x);
}

export const orderFns = {
	count,
	label,
} as const satisfies Record<string, TBuiltInOrderFn>;

export function applyOrderFns(orderFns: TOrderFns, options: ColumnOption[]): ColumnOption[] {
	return [...options].sort((a, b) => {
		for (const orderFn of orderFns) {
			const result = orderFn(a, b);
			if (result !== 0) return result;
		}
		return 0;
	});
}

export function isBuiltInOrderFnName(value: unknown): value is TBuiltInOrderFnName {
	return typeof value === "string" && value in orderFns;
}

export function isOrderDirection(value: unknown): value is OrderDirection {
	return typeof value === "string" && (value === "asc" || value === "desc");
}

export function isCustomOrderFn(value: unknown): value is TCustomOrderFn {
	return typeof value === "function" && value.length === 2;
}

export function isBuiltInOrderFnTuple(
	value: unknown
): value is [TBuiltInOrderFnName, OrderDirection] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		isBuiltInOrderFnName(value[0]) &&
		isOrderDirection(value[1])
	);
}

export function isOrderFnArg(value: unknown): value is TOrderFnArg {
	return isBuiltInOrderFnTuple(value) || isCustomOrderFn(value);
}
