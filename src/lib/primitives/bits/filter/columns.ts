import { isAnyOf, minMax, uniq } from "./array.js";
import { isColumnOptionArray } from "./helpers.js";
import { memo } from "./memo.js";
import {
	applyOrderFns,
	isBuiltInOrderFnName,
	isBuiltInOrderFnTuple,
	isCustomOrderFn,
	isOrderDirection,
	orderFns,
} from "./order-fns.js";
import type {
	Column,
	ColumnConfig,
	ColumnDataType,
	ColumnMeta,
	ColumnOption,
	ElementType,
	FilterStrategy,
	MinMaxReturn,
	Nullable,
	NumericValue,
	OrderDirection,
	TAccessorFn,
	TBuiltInOrderFnName,
	TCustomOrderFn,
	TOrderFnArg,
	TOrderFns,
	TTransformOptionsFn,
	TTransformValueToOptionFn,
} from "./types.js";

export class ColumnConfigBuilder<
	TData,
	TType extends ColumnDataType = any,
	TVal = unknown,
	TId extends string = string,
> {
	private config: Partial<ColumnConfig<TData, TType, TVal, TId>>;

	constructor(type: TType) {
		this.config = { type } as Partial<ColumnConfig<TData, TType, TVal, TId>>;
	}

	private clone(): ColumnConfigBuilder<TData, TType, TVal, TId> {
		const newInstance = new ColumnConfigBuilder<TData, TType, TVal, TId>(
			this.config.type as TType
		);
		newInstance.config = { ...this.config };
		return newInstance;
	}

	id<TNewId extends string>(value: TNewId): ColumnConfigBuilder<TData, TType, TVal, TNewId> {
		const newInstance = this.clone() as ColumnConfigBuilder<any, any, any, any>;
		newInstance.config.id = value;
		return newInstance as ColumnConfigBuilder<TData, TType, TVal, TNewId>;
	}

	accessor<TNewVal>(
		accessor: TAccessorFn<TData, TNewVal>
	): ColumnConfigBuilder<TData, TType, TNewVal, TId> {
		const newInstance = this.clone() as ColumnConfigBuilder<any, any, any, any>;
		newInstance.config.accessor = accessor;
		return newInstance as ColumnConfigBuilder<TData, TType, TNewVal, TId>;
	}

	displayName(value: string): ColumnConfigBuilder<TData, TType, TVal, TId> {
		const newInstance = this.clone();
		newInstance.config.displayName = value;
		return newInstance;
	}

	icon(value: ColumnOption["icon"]): ColumnConfigBuilder<TData, TType, TVal, TId> {
		const newInstance = this.clone();
		newInstance.config.icon = value;
		return newInstance;
	}

	hidden(value: boolean): ColumnConfigBuilder<TData, TType, TVal, TId> {
		const newInstance = this.clone();
		newInstance.config.hidden = value;
		return newInstance;
	}

	min(value: TType extends "number" ? number : TType extends "bigint" ? bigint : never): this {
		this.validateType(["number", "bigint"], "min()");
		this.config.min = value as any;
		return this;
	}

	max(value: TType extends "number" ? number : TType extends "bigint" ? bigint : never): this {
		this.validateType(["number", "bigint"], "max()");
		this.config.max = value as any;
		return this;
	}

	options(value: ColumnOption[]): this {
		this.validateType(["option", "multiOption"], "options()");
		this.config.options = value as any;
		return this;
	}

	transformValueToOptionFn(fn: TTransformValueToOptionFn<TVal>): this {
		this.validateType(["option", "multiOption"], "transformValueToOptionFn()");
		this.config.transformValueToOptionFn = fn as any;
		return this;
	}

	transformOptionsFn(fn: TTransformOptionsFn): this {
		this.validateType(["option", "multiOption"], "transformOptionsFn()");
		this.config.transformOptionsFn = fn as any;
		return this;
	}

	orderFn(name: TBuiltInOrderFnName, direction: OrderDirection): this;
	orderFn(customFn: TCustomOrderFn): this;
	orderFn(...args: TOrderFnArg[]): this;
	orderFn(...args: any[]): this {
		this.validateType(["option", "multiOption"], "orderFn()");

		const orderFnsToApply: TOrderFns = [];

		if (args.length === 2 && isBuiltInOrderFnName(args[0]) && isOrderDirection(args[1])) {
			const [name, direction] = args;
			orderFnsToApply.push((a: ColumnOption, b: ColumnOption) =>
				orderFns[name](a, b, direction)
			);
		} else if (args.length === 1 && isCustomOrderFn(args[0])) {
			orderFnsToApply.push(args[0]);
		} else {
			for (const arg of args) {
				if (isBuiltInOrderFnTuple(arg)) {
					const [name, direction] = arg;
					orderFnsToApply.push((a: ColumnOption, b: ColumnOption) =>
						orderFns[name](a, b, direction)
					);
				} else if (isCustomOrderFn(arg)) {
					orderFnsToApply.push(arg);
				} else {
					throw new Error(
						`Invalid argument: ${JSON.stringify(arg)}. Expected built-in function tuple or custom function.`
					);
				}
			}
		}

		this.config.orderFn = orderFnsToApply as any;
		return this;
	}

	toggledStateName(
		value: string
	): ColumnConfigBuilder<TData, TType extends "boolean" ? TType : never, TVal, TId> {
		if (this.config.type !== "boolean") {
			throw new Error("toggledStateName() is only applicable to boolean columns");
		}

		const newInstance = this.clone() as ColumnConfigBuilder<any, any, any, any>;
		newInstance.config.toggledStateName = value;
		return newInstance;
	}

	meta(value: ColumnMeta): ColumnConfigBuilder<TData, TType, TVal, TId> {
		const newInstance = this.clone();
		newInstance.config.meta = value;
		return newInstance;
	}

	private validateType(expectedTypes: ColumnDataType | ColumnDataType[], methodName: string) {
		const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
		if (!isAnyOf(this.config.type, types)) {
			throw new Error(
				`[Column config builder] ${methodName} is only applicable to ${types.join(" or ")} columns`
			);
		}
	}

	build(): ColumnConfig<TData, TType, TVal, TId> {
		this.validateRequiredFields();
		return this.config as ColumnConfig<TData, TType, TVal, TId>;
	}

	private validateRequiredFields() {
		if (!this.config.id) throw new Error("id is required");
		if (!this.config.accessor) throw new Error("accessor is required");
		if (!this.config.displayName) throw new Error("displayName is required");
	}
}

interface FluentColumnConfigHelper<TData> {
	text: () => ColumnConfigBuilder<TData, "text", string>;
	number: () => ColumnConfigBuilder<TData, "number", number>;
	bigint: () => ColumnConfigBuilder<TData, "bigint", bigint>;
	date: () => ColumnConfigBuilder<TData, "date", Date>;
	boolean: () => ColumnConfigBuilder<TData, "boolean", boolean>;
	option: () => ColumnConfigBuilder<TData, "option", string>;
	multiOption: () => ColumnConfigBuilder<TData, "multiOption", string[]>;
}

export function createColumnConfigHelper<TData>(): FluentColumnConfigHelper<TData> {
	return {
		text: () => new ColumnConfigBuilder<TData, "text", string>("text"),
		number: () => new ColumnConfigBuilder<TData, "number", number>("number"),
		bigint: () => new ColumnConfigBuilder<TData, "bigint", bigint>("bigint"),
		date: () => new ColumnConfigBuilder<TData, "date", Date>("date"),
		boolean: () => new ColumnConfigBuilder<TData, "boolean", boolean>("boolean"),
		option: () => new ColumnConfigBuilder<TData, "option", string>("option"),
		multiOption: () => new ColumnConfigBuilder<TData, "multiOption", string[]>("multiOption"),
	};
}

class ColumnDataService<TData> {
	private data: TData[];
	private strategy: FilterStrategy;

	constructor(data: TData[], strategy: FilterStrategy) {
		this.data = data;
		this.strategy = strategy;
	}

	computeBaseOptions<TType extends ColumnDataType, TVal>(
		column: ColumnConfig<TData, TType, TVal>
	): ColumnOption[] {
		if (!isAnyOf(column.type, ["option", "multiOption"])) return [];

		if (this.strategy === "server" && !column.options) {
			throw new Error("column options are required for server-side filtering");
		}

		if (column.options) return column.options;

		const filtered = this.data
			.flatMap(column.accessor)
			.filter((v): v is NonNullable<TVal> => v !== undefined && v !== null);

		const uniqueValues = uniq(filtered);
		const columnOptions = column.transformValueToOptionFn
			? uniqueValues.map((m) =>
					column.transformValueToOptionFn!(m as ElementType<NonNullable<TVal>>)
				)
			: [];

		if (isColumnOptionArray(columnOptions)) return columnOptions;

		throw new Error(
			`[filter] [${column.id}] Either provide static options, a transformValueToOptionFn, or ensure the column data conforms to ColumnOption type`
		);
	}

	computeOrderedOptions<TType extends ColumnDataType, TVal>(
		column: ColumnConfig<TData, TType, TVal>
	): ColumnOption[] {
		const baseOptions = this.computeBaseOptions(column);
		const values = this.getValues(column);
		const facetedData = this.computeFacetedUniqueValues(column, values as any);
		const optionsWithCounts = baseOptions.map((option) => ({
			...option,
			count: facetedData?.get(option.value) || 0,
		}));

		if (column.orderFn) return applyOrderFns(column.orderFn, optionsWithCounts);
		return optionsWithCounts;
	}

	computeTransformedOptions<TType extends ColumnDataType, TVal>(
		column: ColumnConfig<TData, TType, TVal>
	): ColumnOption[] {
		const orderedOptions = this.computeOrderedOptions(column);
		if (!column.transformOptionsFn) return orderedOptions;
		return column.transformOptionsFn(orderedOptions);
	}

	getValues<TType extends ColumnDataType, TVal>(
		column: ColumnConfig<TData, TType, TVal>
	): ElementType<NonNullable<TVal>>[] {
		const memoizedAccessor = memo(
			() => [this.data],
			(deps) =>
				(deps[0] ?? [])
					.flatMap(column.accessor)
					.filter((v): v is NonNullable<TVal> => v !== undefined && v !== null) as ElementType<
					NonNullable<TVal>
				>[],
			{ key: `accessor-${column.id}` }
		);

		const raw = memoizedAccessor();
		if (!isAnyOf(column.type, ["option", "multiOption"])) return raw;

		if (column.options) {
			return raw
				.flatMap((v) => (Array.isArray(v) ? v : [v]))
				.map((v) => column.options?.find((o) => o.value === v)?.value)
				.filter((v) => v !== undefined && v !== null) as ElementType<NonNullable<TVal>>[];
		}

		if (column.transformValueToOptionFn) {
			return raw
				.flatMap((v) => (Array.isArray(v) ? v : [v]))
				.map((v) => column.transformValueToOptionFn!(v as ElementType<NonNullable<TVal>>).value)
				.filter((v) => v !== undefined && v !== null) as ElementType<NonNullable<TVal>>[];
		}

		if (isColumnOptionArray(raw)) return raw as ElementType<NonNullable<TVal>>[];

		throw new Error(
			`[filter] [${column.id}] Either provide static options, a transformValueToOptionFn, or ensure the column data conforms to ColumnOption type`
		);
	}

	computeFacetedUniqueValues<TType extends ColumnDataType, TVal>(
		column: ColumnConfig<TData, TType, TVal>,
		values: string[] | ColumnOption[]
	): Map<string, number> | undefined {
		if (!isAnyOf(column.type, ["option", "multiOption"])) return new Map<string, number>();
		if (this.strategy === "server") return column.facetedOptions;

		const acc = new Map<string, number>();
		if (isColumnOptionArray(values)) {
			for (const option of values) {
				acc.set(option.value, (acc.get(option.value) ?? 0) + 1);
			}
		} else {
			for (const option of values) {
				acc.set(option, (acc.get(option) ?? 0) + 1);
			}
		}
		return acc;
	}

	computeFacetedMinMaxValues<TType extends ColumnDataType, TVal>(
		column: ColumnConfig<TData, TType, TVal>
	): MinMaxReturn<TType> {
		if (!isAnyOf(column.type, ["number", "bigint"])) return undefined as MinMaxReturn<TType>;

		if (column.min !== undefined && column.max !== undefined) {
			return [column.min, column.max] as MinMaxReturn<TType>;
		}

		if (this.strategy === "server") return undefined as MinMaxReturn<TType>;

		const rawValues = this.data
			.flatMap((row) => column.accessor(row) as Nullable<NumericValue>)
			.filter(
				(v): v is NumericValue =>
					(typeof v === "number" && !Number.isNaN(v)) || typeof v === "bigint"
			);

		if (rawValues.length === 0) {
			return (column.type === "bigint" ? [0n, 0n] : [0, 0]) as MinMaxReturn<TType>;
		}

		if (column.type === "number") {
			const numberValues = rawValues.filter((v): v is number => typeof v === "number");
			return minMax(numberValues) as MinMaxReturn<TType>;
		}

		const bigintValues = rawValues.filter((v): v is bigint => typeof v === "bigint");
		return minMax(bigintValues) as MinMaxReturn<TType>;
	}
}

export function createColumns<TData>(
	data: TData[],
	columnConfigs: ReadonlyArray<ColumnConfig<TData, any, any, any>>,
	strategy: FilterStrategy
): Column<TData>[] {
	return columnConfigs.map((columnConfig) => createColumn(columnConfig, data, strategy));
}

export function createColumn<TData>(
	columnConfig: ColumnConfig<TData, any, any, any>,
	data: TData[],
	strategy: FilterStrategy
): Column<TData> {
	const dataService = new ColumnDataService(data, strategy);
	const getValues = createMemoizedValues(columnConfig, dataService);
	const getUniqueValues = createMemoizedUniqueValues(columnConfig, dataService, getValues);
	const getMinMaxValues = createMemoizedMinMaxValues(columnConfig, dataService);
	const getOptions = createMemoizedOptions(columnConfig, dataService, getValues);

	const column: Column<TData> = {
		...columnConfig,
		getOptions,
		getValues,
		getFacetedUniqueValues: getUniqueValues,
		getFacetedMinMaxValues: getMinMaxValues,
		prefetchOptions: async () => {},
		prefetchValues: async () => {},
		prefetchFacetedUniqueValues: async () => {},
		prefetchFacetedMinMaxValues: async () => {},
		_prefetchedOptionsCache: null,
		_prefetchedValuesCache: null,
		_prefetchedFacetedUniqueValuesCache: null,
		_prefetchedFacetedMinMaxValuesCache: null,
	};

	if (strategy === "client") {
		setupPrefetchMethods(column, {
			getOptions,
			getValues,
			getUniqueValues,
			getMinMaxValues,
		});
	}

	return column;
}

function createMemoizedOptions<TData>(
	columnConfig: ColumnConfig<TData, any, any, any>,
	dataService: ColumnDataService<TData>,
	getValues: () => ElementType<NonNullable<any>>[]
) {
	return memo(
		() => [
			dataService,
			columnConfig.options,
			columnConfig.transformValueToOptionFn,
			columnConfig.transformOptionsFn,
			columnConfig.orderFn,
			getValues(),
		],
		() => dataService.computeTransformedOptions(columnConfig),
		{ key: `final-options-${columnConfig.id}` }
	);
}

function createMemoizedValues<TData>(
	columnConfig: ColumnConfig<TData, any, any, any>,
	dataService: ColumnDataService<TData>
) {
	return memo(
		() => [dataService],
		([service]) => service.getValues(columnConfig),
		{ key: `values-${columnConfig.id}` }
	);
}

function createMemoizedUniqueValues<TData>(
	columnConfig: ColumnConfig<TData, any, any, any>,
	dataService: ColumnDataService<TData>,
	getValues: () => ElementType<NonNullable<any>>[]
) {
	return memo(
		() => [getValues(), dataService],
		([values, service]) => service.computeFacetedUniqueValues(columnConfig, values as any),
		{ key: `faceted-${columnConfig.id}` }
	);
}

function createMemoizedMinMaxValues<TData, TType extends ColumnDataType>(
	columnConfig: ColumnConfig<TData, TType, any, any>,
	dataService: ColumnDataService<TData>
) {
	return memo(
		() => [dataService],
		([service]) => service.computeFacetedMinMaxValues(columnConfig),
		{ key: `minmax-${columnConfig.id}` }
	);
}

function setupPrefetchMethods<TData>(
	column: Column<TData>,
	methods: {
		getOptions: () => any;
		getValues: () => any;
		getUniqueValues: () => any;
		getMinMaxValues: () => any;
	}
) {
	const { getOptions, getValues, getUniqueValues, getMinMaxValues } = methods;

	column.prefetchOptions = async (): Promise<void> => {
		if (column._prefetchedOptionsCache) return;
		await new Promise((resolve) =>
			setTimeout(() => {
				column._prefetchedOptionsCache = getOptions();
				resolve(undefined);
			}, 0)
		);
	};

	column.prefetchValues = async (): Promise<void> => {
		if (column._prefetchedValuesCache) return;
		await new Promise((resolve) =>
			setTimeout(() => {
				column._prefetchedValuesCache = getValues();
				resolve(undefined);
			}, 0)
		);
	};

	column.prefetchFacetedUniqueValues = async (): Promise<void> => {
		if (column._prefetchedFacetedUniqueValuesCache) return;
		await new Promise((resolve) =>
			setTimeout(() => {
				column._prefetchedFacetedUniqueValuesCache = getUniqueValues() ?? null;
				resolve(undefined);
			}, 0)
		);
	};

	column.prefetchFacetedMinMaxValues = async (): Promise<void> => {
		if (column._prefetchedFacetedMinMaxValuesCache) return;
		await new Promise((resolve) =>
			setTimeout(() => {
				column._prefetchedFacetedMinMaxValuesCache = getMinMaxValues() ?? null;
				resolve(undefined);
			}, 0)
		);
	};
}
