import type { Expand } from "svelte-toolbelt";
import type { Component, ComponentType, Snippet, SvelteComponent } from "svelte";
import type { OnChangeFn, WithChild, WithChildren, Without } from "$lib/primitives/internal/types.js";
import type {
	BitsPrimitiveButtonAttributes,
	BitsPrimitiveDivAttributes,
	BitsPrimitiveInputAttributes,
	BitsPrimitiveSpanAttributes,
} from "$lib/primitives/shared/attributes.js";
import type { PortalProps } from "$lib/primitives/bits/utilities/portal/types.js";
import type { FilterNodeDef } from "./menu-nodes.js";

export type ElementType<T> = T extends (infer U)[] ? U : T;
export type Nullable<T> = T | null | undefined;

export type FiltersStateUpdaterFn<TContext> = (
	prev: FiltersState,
	next: FiltersState,
	context?: TContext
) => void;

// Consumers can augment this interface to attach domain-specific metadata.
export interface ColumnMeta {}

export type FilterIconProps = {
	size?: number;
	class?: string;
	"aria-hidden"?: boolean | "true" | "false";
};

export type FilterIconComponent =
	| Component<FilterIconProps>
	| ComponentType<SvelteComponent<FilterIconProps>>;

export type FilterIcon = Snippet | FilterIconComponent;

export interface ColumnOption {
	label: string;
	value: string;
	icon?: FilterIcon;
	count?: number;
	keywords?: string[];
	description?: string;
}

export interface ColumnOptionExtended extends ColumnOption {
	selected?: boolean;
	count?: number;
}

export type NumericValue = number | bigint;

export type ColumnDataType =
	| "text"
	| "number"
	| "bigint"
	| "date"
	| "boolean"
	| "option"
	| "multiOption";

export type OptionBasedColumnDataType = Extract<ColumnDataType, "option" | "multiOption">;

export type ColumnDataNativeMap = {
	text: string;
	number: number;
	bigint: bigint;
	date: Date;
	boolean: boolean;
	option: string;
	multiOption: string[];
};

export type FilterValues<T extends ColumnDataType> = Array<ElementType<ColumnDataNativeMap[T]>>;

export type TAccessorFn<TData, TVal = unknown> = (data: TData) => TVal;
export type TTransformValueToOptionFn<TVal = unknown> = (
	value: ElementType<NonNullable<TVal>>
) => ColumnOption;

export type TOrderFns = TOrderFn[];
export type TOrderFn = TCustomOrderFn;
export type TCustomOrderFn = (a: ColumnOption, b: ColumnOption) => number;
export type TBuiltInOrderFn = (
	a: ColumnOption,
	b: ColumnOption,
	direction: OrderDirection
) => number;
export type TOrderFnArg = [TBuiltInOrderFnName, OrderDirection] | TCustomOrderFn;
export type OrderDirection = "asc" | "desc";
export type TBuiltInOrderFnName = "count" | "label";
export type TTransformOptionsFn = (options: ColumnOption[]) => ColumnOption[];

export type ColumnConfig<
	TData,
	TType extends ColumnDataType = ColumnDataType,
	TVal = unknown,
	TId extends string = string,
> = {
	id: TId;
	accessor: TAccessorFn<TData, TVal>;
	displayName: string;
	icon?: FilterIcon;
	type: TType;
	hidden?: boolean;
	group?: string;
	pluralName?: string;
	options?: TType extends OptionBasedColumnDataType ? ColumnOption[] : never;
	facetedOptions?: TType extends OptionBasedColumnDataType ? Map<string, number> : never;
	min?: TType extends "number" ? number : TType extends "bigint" ? bigint : never;
	max?: TType extends "number" ? number : TType extends "bigint" ? bigint : never;
	transformValueToOptionFn?: TType extends OptionBasedColumnDataType
		? TTransformValueToOptionFn<TVal>
		: never;
	orderFn?: TType extends OptionBasedColumnDataType ? TOrderFns : never;
	transformOptionsFn?: TType extends OptionBasedColumnDataType ? TTransformOptionsFn : never;
	toggledStateName?: TType extends "boolean" ? string : never;
	meta?: ColumnMeta;
};

export type OptionColumnId<T> =
	T extends ColumnConfig<infer _TData, "option" | "multiOption", infer _TVal, infer TId>
		? TId
		: never;

export type OptionColumnIds<T extends ReadonlyArray<ColumnConfig<any, any, any, any>>> = {
	[K in keyof T]: OptionColumnId<T[K]>;
}[number];

export type NumberColumnId<T> =
	T extends ColumnConfig<infer _TData, "number", infer _TVal, infer TId> ? TId : never;

export type NumberColumnIds<T extends ReadonlyArray<ColumnConfig<any, any, any, any>>> = {
	[K in keyof T]: NumberColumnId<T[K]>;
}[number];

export type BigIntColumnId<T> =
	T extends ColumnConfig<infer _TData, "bigint", infer _TVal, infer TId> ? TId : never;

export type BigIntColumnIds<T extends ReadonlyArray<ColumnConfig<any, any, any, any>>> = {
	[K in keyof T]: BigIntColumnId<T[K]>;
}[number];

export type DataTableFilterConfig<TData> = {
	data: TData[];
	columns: ColumnConfig<TData>[];
};

export type MinMaxReturn<T extends ColumnDataType> = T extends "number"
	? [number, number] | undefined
	: T extends "bigint"
		? [bigint, bigint] | undefined
		: undefined;

export type ColumnProperties<TData, TType extends ColumnDataType, TVal> = {
	getOptions: () => ColumnOption[];
	getValues: () => ElementType<NonNullable<TVal>>[];
	getFacetedUniqueValues: () => Map<string, number> | undefined;
	getFacetedMinMaxValues: () => MinMaxReturn<TType>;
	prefetchOptions: () => Promise<void>;
	prefetchValues: () => Promise<void>;
	prefetchFacetedUniqueValues: () => Promise<void>;
	prefetchFacetedMinMaxValues: () => Promise<void>;
};

export type ColumnPrivateProperties<TData, TVal> = {
	_prefetchedOptionsCache: ColumnOption[] | null;
	_prefetchedValuesCache: ElementType<NonNullable<TVal>>[] | null;
	_prefetchedFacetedUniqueValuesCache: Map<string, number> | null;
	_prefetchedFacetedMinMaxValuesCache: [number, number] | [bigint, bigint] | null;
};

export type Column<
	TData,
	TType extends ColumnDataType = ColumnDataType,
	TVal = unknown,
> = ColumnConfig<TData, TType, TVal> &
	ColumnProperties<TData, TType, TVal> &
	ColumnPrivateProperties<TData, TVal>;

export type FilterStrategy = "client" | "server";

export type TextFilterOperator = "contains" | "does not contain";
export type NumberFilterOperator =
	| "is"
	| "is not"
	| "is less than"
	| "is greater than or equal to"
	| "is greater than"
	| "is less than or equal to"
	| "is between"
	| "is not between";
export type BigIntFilterOperator = NumberFilterOperator;
export type DateFilterOperator =
	| "is"
	| "is not"
	| "is before"
	| "is on or after"
	| "is after"
	| "is on or before"
	| "is between"
	| "is not between";
export type BooleanFilterOperator = "is" | "is not";
export type OptionFilterOperator = "is" | "is not" | "is any of" | "is none of";
export type MultiOptionFilterOperator =
	| "include"
	| "exclude"
	| "include any of"
	| "include all of"
	| "include exactly"
	| "exclude if any of"
	| "exclude if all"
	| "exclude exactly";

export type FilterOperators = {
	text: TextFilterOperator;
	number: NumberFilterOperator;
	bigint: BigIntFilterOperator;
	date: DateFilterOperator;
	boolean: BooleanFilterOperator;
	option: OptionFilterOperator;
	multiOption: MultiOptionFilterOperator;
};

export type FilterModel<TType extends ColumnDataType = ColumnDataType> = {
	columnId: string;
	type: TType;
	operator: FilterOperators[TType];
	values: FilterValues<TType>;
};

export type FiltersState = FilterModel[];

export type FilterDetails<T extends ColumnDataType> = {
	[key in FilterOperators[T]]: FilterOperatorDetails<key, T>;
};

export type FilterOperatorTarget = "single" | "multiple" | "any";

export type FilterOperatorDetailsBase<OperatorValue, T extends ColumnDataType> = {
	key: string;
	value: OperatorValue;
	target: FilterOperatorTarget;
	singularOf?: FilterOperators[T];
	pluralOf?: FilterOperators[T];
	relativeOf: FilterOperators[T] | Array<FilterOperators[T]>;
	isNegated: boolean;
	negation?: FilterOperators[T];
	negationOf?: FilterOperators[T];
};

export type FilterOperatorDetails<
	OperatorValue,
	T extends ColumnDataType,
> = FilterOperatorDetailsBase<OperatorValue, T> &
	(
		| { singularOf?: never; pluralOf?: never }
		| { target: "any"; singularOf?: never; pluralOf?: never }
		| { target: "single"; singularOf: FilterOperators[T]; pluralOf?: never }
		| { target: "multiple"; singularOf?: never; pluralOf: FilterOperators[T] }
	) &
	(
		| { isNegated: false; negation: FilterOperators[T]; negationOf?: never }
		| { isNegated: true; negation?: never; negationOf: FilterOperators[T] }
	);

export type FilterTypeOperatorDetails = {
	[key in ColumnDataType]: FilterDetails<key>;
};

export type FacetedColumnData<TColumns extends ReadonlyArray<ColumnConfig<any, any, any, any>>> =
	Partial<
		| Record<OptionColumnIds<TColumns>, Map<string, number> | undefined>
		| Record<NumberColumnIds<TColumns>, [number, number] | undefined>
		| Record<BigIntColumnIds<TColumns>, [bigint, bigint] | undefined>
	>;

export interface DataTableFilterActions<TContext = any> {
	addFilterValue: <TData, TType extends OptionBasedColumnDataType>(
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"],
		context?: TContext
	) => void;
	removeFilterValue: <TData, TType extends OptionBasedColumnDataType>(
		column: Column<TData, TType>,
		value: FilterModel<TType>["values"],
		context?: TContext
	) => void;
	setFilterValue: <TData, TType extends ColumnDataType>(
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"],
		context?: TContext
	) => void;
	setFilterOperator: <TType extends ColumnDataType>(
		columnId: string,
		operator: FilterModel<TType>["operator"],
		context?: TContext
	) => void;
	removeFilter: (columnId: string, context?: TContext) => void;
	removeAllFilters: (context?: TContext) => void;
	batch: (
		callback: (batchActions: DataTableFilterBatchActions) => void,
		context?: TContext
	) => void;
}

export interface FilterOperations {
	addFilterValue: <TData, TType extends OptionBasedColumnDataType>(
		filters: FiltersState,
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"]
	) => FiltersState;
	removeFilterValue: <TData, TType extends OptionBasedColumnDataType>(
		filters: FiltersState,
		column: Column<TData, TType>,
		value: FilterModel<TType>["values"]
	) => FiltersState;
	setFilterValue: <TData, TType extends ColumnDataType>(
		filters: FiltersState,
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"]
	) => FiltersState;
	setFilterOperator: <TType extends ColumnDataType>(
		filters: FiltersState,
		columnId: string,
		operator: FilterModel<TType>["operator"]
	) => FiltersState;
	removeFilter: (filters: FiltersState, columnId: string) => FiltersState;
	removeAllFilters: (filters: FiltersState) => FiltersState;
}

export interface DataTableFilterBatchActions extends BatchFilterOperations {}

export interface BatchFilterOperations {
	addFilterValue: <TData, TType extends OptionBasedColumnDataType>(
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"]
	) => void;
	removeFilterValue: <TData, TType extends OptionBasedColumnDataType>(
		column: Column<TData, TType>,
		value: FilterModel<TType>["values"]
	) => void;
	setFilterValue: <TData, TType extends ColumnDataType>(
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"]
	) => void;
	setFilterOperator: <TType extends ColumnDataType>(
		columnId: string,
		operator: FilterModel<TType>["operator"]
	) => void;
	removeFilter: (columnId: string) => void;
	removeAllFilters: () => void;
}

export interface DataTableFiltersOptions<
	TData,
	TColumns extends ReadonlyArray<ColumnConfig<TData, any, any, any>>,
	TStrategy extends FilterStrategy,
	TContext = any,
> {
	strategy: TStrategy;
	data: TData[];
	columnsConfig: TColumns;
	defaultFilters?: FiltersState;
	filters?: FiltersState;
	onFiltersChange?: FiltersStateUpdaterFn<TContext> | OnChangeFn<FiltersState>;
	options?: Partial<Record<OptionColumnIds<TColumns>, ColumnOption[] | undefined>>;
	faceted?: FacetedColumnData<TColumns>;
	entityName?: string;
}

export interface DataTableFiltersInstance<TData, TStrategy extends FilterStrategy, TContext = any> {
	columns: Column<TData>[];
	filters: FiltersState;
	actions: DataTableFilterActions<TContext>;
	strategy: TStrategy;
	entityName?: string;
}

export type DurationUnit = "ms" | "milliseconds" | "seconds" | "minutes" | "hours" | "days";

export interface NumberUnitConfig {
	unit: DurationUnit;
}

export interface ParsedNumberInput {
	value: number;
	hasDurationUnit: boolean;
	isRange: boolean;
	rangeValues?: [number, number];
}

export type Locale = "en" | "fr" | "nl" | "zh_CN" | "zh_TW" | "de";
export type FilterVariant = "default" | "clean";

export interface FilterContextValue<TData = unknown, TContext = any> {
	columns: Column<TData>[];
	filters: FiltersState;
	actions: DataTableFilterActions<TContext>;
	strategy: FilterStrategy;
	locale: Locale;
	entityName?: string;
	variant?: FilterVariant;
}

export interface FilterItemContextValue<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
> {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
	actions: DataTableFilterActions<TContext>;
	strategy: FilterStrategy;
	locale: Locale;
	entityName?: string;
	variant?: FilterVariant;
}

export type FilterProviderPropsWithoutHTML<TData = unknown, TContext = any> = WithChildren<{
	columns: Column<TData>[];
	filters: FiltersState;
	actions: DataTableFilterActions<TContext>;
	strategy: FilterStrategy;
	locale?: Locale;
	entityName?: string;
	variant?: FilterVariant;
}>;

export type FilterProviderProps<TData = unknown, TContext = any> = FilterProviderPropsWithoutHTML<
	TData,
	TContext
>;

export type FilterRootPropsWithoutHTML = WithChild;
export type FilterRootProps = FilterRootPropsWithoutHTML &
	Without<BitsPrimitiveDivAttributes, FilterRootPropsWithoutHTML>;

export type FilterTriggerPropsWithoutHTML = WithChild<{
	hasVisibleFilters?: boolean;
	locale?: Locale;
	variant?: FilterVariant;
}>;
export type FilterTriggerProps = FilterTriggerPropsWithoutHTML &
	Without<BitsPrimitiveButtonAttributes, FilterTriggerPropsWithoutHTML>;

export type FilterMenuPropsWithoutHTML<TData = unknown, TContext = any> = {
	columns?: Column<TData>[];
	filters?: FiltersState;
	actions?: DataTableFilterActions<TContext>;
	strategy?: FilterStrategy;
	locale?: Locale;
	variant?: FilterVariant;
	children?: Snippet;
	open?: boolean;
	onOpenChange?: OnChangeFn<boolean>;
	groups?: FilterMenuGroup[];
};
export type FilterMenuGroup = {
	id: string;
	label?: string;
	nodes?: FilterNodeDef[];
};
export type FilterMenuProps<TData = unknown, TContext = any> = FilterMenuPropsWithoutHTML<
	TData,
	TContext
>;

export type FilterListSnippetProps<TData = unknown> = {
	filter: FilterModel;
	column: Column<TData>;
};
export type FilterListPropsWithoutHTML<TData = unknown> = Omit<
	WithChild<{}, { _default: never }, HTMLDivElement>,
	"children"
> & {
	children?: Snippet<[FilterListSnippetProps<TData>]>;
};
export type FilterListProps<TData = unknown> = FilterListPropsWithoutHTML<TData> &
	Without<BitsPrimitiveDivAttributes, FilterListPropsWithoutHTML<TData>>;

export type FilterListMobileContainerPropsWithoutHTML = WithChild;
export type FilterListMobileContainerProps = FilterListMobileContainerPropsWithoutHTML &
	Without<BitsPrimitiveDivAttributes, FilterListMobileContainerPropsWithoutHTML>;

export type FilterItemPropsWithoutHTML<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
> = WithChild<{
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
	variant?: FilterVariant;
}>;
export type FilterItemProps<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
> = FilterItemPropsWithoutHTML<TData, TType> &
	Without<BitsPrimitiveDivAttributes, FilterItemPropsWithoutHTML<TData, TType>>;

export type FilterSubjectPropsWithoutHTML<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
> = WithChild<{
	column?: Column<TData, TType>;
	entityName?: string;
	variant?: FilterVariant;
}>;
export type FilterSubjectProps<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
> = FilterSubjectPropsWithoutHTML<TData, TType> &
	Without<BitsPrimitiveSpanAttributes, FilterSubjectPropsWithoutHTML<TData, TType>>;

export type FilterOperatorPropsWithoutHTML<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
> = WithChild<{
	column?: Column<TData, TType>;
	filter?: FilterModel<TType>;
	actions?: DataTableFilterActions<TContext>;
	locale?: Locale;
	variant?: FilterVariant;
}>;
export type FilterOperatorProps<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
> = FilterOperatorPropsWithoutHTML<TData, TType, TContext> &
	Without<BitsPrimitiveButtonAttributes, FilterOperatorPropsWithoutHTML<TData, TType, TContext>>;

export type FilterValuePropsWithoutHTML<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
> = WithChild<{
	filter?: FilterModel<TType>;
	column?: Column<TData, TType>;
	actions?: DataTableFilterActions<TContext>;
	strategy?: FilterStrategy;
	locale?: Locale;
	entityName?: string;
	variant?: FilterVariant;
}>;
export type FilterValueProps<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
> = FilterValuePropsWithoutHTML<TData, TType, TContext> &
	Without<BitsPrimitiveButtonAttributes, FilterValuePropsWithoutHTML<TData, TType, TContext>>;

export type FilterValueDisplayProps<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
> = {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
	locale?: Locale;
	entityName?: string;
};

export type FilterValueEditorProps<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
> = Expand<{
	filter?: FilterModel<TType>;
	column: Column<TData, TType>;
	actions: DataTableFilterActions<TContext>;
	strategy?: FilterStrategy;
	locale?: Locale;
	initialValues?: Array<string | number | bigint | boolean | Date>;
	showSeparator?: boolean;
}>;

export type FilterTextEditorProps<TData = unknown, TContext = any> = {
	column: Column<TData, "text">;
	actions: DataTableFilterActions<TContext>;
};

export type FilterNumberEditorProps<TData = unknown, TContext = any> = {
	column: Column<TData, "number">;
	actions: DataTableFilterActions<TContext>;
	baseUnit?: DurationUnit;
};

export type FilterOptionEditorProps<TData = unknown, TContext = any> = {
	column: Column<TData, "option"> | Column<TData, "multiOption">;
	actions: DataTableFilterActions<TContext>;
	filter?: FilterModel<"option"> | FilterModel<"multiOption">;
	locale?: Locale;
	strategy?: FilterStrategy;
	initialValues?: Array<string | number | bigint | boolean | Date>;
	showSeparator?: boolean;
};

export type FilterDateEditorProps<TData = unknown, TContext = any> = {
	column: Column<TData, "date">;
	actions: DataTableFilterActions<TContext>;
	filter?: FilterModel<"date">;
	locale?: Locale;
};

export type FilterRemovePropsWithoutHTML<TContext = any> = WithChild<{
	filter?: FilterModel;
	actions?: DataTableFilterActions<TContext>;
	variant?: FilterVariant;
}>;
export type FilterRemoveProps<TContext = any> = FilterRemovePropsWithoutHTML<TContext> &
	Without<BitsPrimitiveButtonAttributes, FilterRemovePropsWithoutHTML<TContext>>;

export type FilterActionsPropsWithoutHTML<TContext = any> = WithChild<{
	hasFilters?: boolean;
	actions?: DataTableFilterActions<TContext>;
	locale?: Locale;
}>;
export type FilterActionsProps<TContext = any> = FilterActionsPropsWithoutHTML<TContext> &
	Without<BitsPrimitiveButtonAttributes, FilterActionsPropsWithoutHTML<TContext>>;

export type FilterInputPropsWithoutHTML = {
	ref?: HTMLInputElement | null | undefined;
};
export type FilterInputProps = FilterInputPropsWithoutHTML &
	Without<BitsPrimitiveInputAttributes, FilterInputPropsWithoutHTML>;

export type FilterPortalProps = PortalProps;
