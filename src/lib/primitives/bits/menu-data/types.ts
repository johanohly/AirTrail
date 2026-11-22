import type { Snippet } from "svelte";
import type { Expand } from "svelte-toolbelt";
import type { OnChangeFn, WithChildren, Without } from "$lib/primitives/internal/types.js";
import type {
	BitsPrimitiveDivAttributes,
	BitsPrimitiveInputAttributes,
} from "$lib/primitives/shared/attributes.js";

export interface RowRenderContext {
	search: { query: string; score: number } | null;
	breadcrumbs: string[];
	isDeepSearchResult: boolean;
	highlighted: boolean;
	disabled: boolean;
	group: { id: string; label?: string } | null;
}

export interface GroupRenderContext {
	search: { query: string; bestScore: number } | null;
	matchCount: number;
	breadcrumbs: string[];
	isDeepSearchResult: boolean;
}

interface BaseNodeDef<TMeta = any> {
	id: string;
	hidden?: boolean;
	meta?: TMeta;
}

export interface ItemDef<TMeta = any> extends BaseNodeDef<TMeta> {
	kind: "item";
	label: string;
	keywords?: string[];
	disabled?: boolean;
	onSelect?: () => void;
	closeOnSelect?: boolean;
	shortcut?: string;
	value?: string;
}

export interface CheckboxItemDef<TMeta = any> extends BaseNodeDef<TMeta> {
	kind: "checkbox-item";
	label: string;
	keywords?: string[];
	disabled?: boolean;
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
	closeOnSelect?: boolean;
}

export interface SubmenuDef<TMeta = any> extends BaseNodeDef<TMeta> {
	kind: "submenu";
	title: string;
	label?: string;
	keywords?: string[];
	disabled?: boolean;
	nodes?: NodeDef<TMeta>[];
	deepSearch?: boolean;
}

export interface SeparatorDef<TMeta = any> {
	kind: "separator";
	id?: string;
	hidden?: boolean;
	meta?: TMeta;
}

export interface GroupDef<TMeta = any> {
	kind: "group";
	id: string;
	label?: string;
	hidden?: boolean;
	nodes: NodeDef<TMeta>[];
	meta?: TMeta;
}

export interface RadioGroupDef<TMeta = any> {
	kind: "radio-group";
	id: string;
	label?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	hidden?: boolean;
	disabled?: boolean;
	nodes: Array<ItemDef<TMeta> | CheckboxItemDef<TMeta> | SubmenuDef<TMeta>>;
	meta?: TMeta;
}

export type NodeDef<TMeta = any> =
	| ItemDef<TMeta>
	| CheckboxItemDef<TMeta>
	| SubmenuDef<TMeta>
	| SeparatorDef<TMeta>
	| GroupDef<TMeta>
	| RadioGroupDef<TMeta>;

export interface ScoredNode<TMeta = any> {
	node: ItemDef<TMeta> | CheckboxItemDef<TMeta> | SubmenuDef<TMeta>;
	score: number;
	breadcrumbs: string[];
	breadcrumbIds: string[];
	group: { id: string; label?: string; groupDef: GroupDef<TMeta> } | null;
	radioGroup: { id: string; label?: string; radioGroupDef: RadioGroupDef<TMeta> } | null;
}

export interface DisplayRowNode<TMeta = any> {
	node: ItemDef<TMeta> | CheckboxItemDef<TMeta> | SubmenuDef<TMeta>;
	context: RowRenderContext;
}

export interface DisplayGroupNode<TMeta = any> {
	kind: "group";
	group: GroupDef<TMeta>;
	context: GroupRenderContext;
	items: Array<DisplayRowNode<TMeta>>;
	bestScore: number;
}

export interface DisplayRadioGroupNode<TMeta = any> {
	kind: "radio-group";
	radioGroup: RadioGroupDef<TMeta>;
	context: GroupRenderContext;
	items: Array<DisplayRowNode<TMeta>>;
	bestScore: number;
}

export interface DisplaySeparatorNode<TMeta = any> {
	kind: "separator";
	separator: SeparatorDef<TMeta>;
}

export type DisplayNode<TMeta = any> =
	| DisplayRowNode<TMeta>
	| DisplayGroupNode<TMeta>
	| DisplayRadioGroupNode<TMeta>
	| DisplaySeparatorNode<TMeta>;

export function isDisplayGroupNode<TMeta>(node: DisplayNode<TMeta>): node is DisplayGroupNode<TMeta> {
	return "kind" in node && node.kind === "group";
}

export function isDisplayRadioGroupNode<TMeta>(
	node: DisplayNode<TMeta>
): node is DisplayRadioGroupNode<TMeta> {
	return "kind" in node && node.kind === "radio-group";
}

export function isDisplaySeparatorNode<TMeta>(
	node: DisplayNode<TMeta>
): node is DisplaySeparatorNode<TMeta> {
	return "kind" in node && node.kind === "separator";
}

export function isDisplayRowNode<TMeta>(node: DisplayNode<TMeta>): node is DisplayRowNode<TMeta> {
	return !("kind" in node);
}

export type GroupBehavior = "flatten" | "preserve";
export type RadioGroupBehavior = "flatten" | "preserve" | "preserve-show-all";

export interface DeepSearchConfig {
	enabled?: boolean;
	minLength?: number;
	groupSearchBehavior?: GroupBehavior;
	radioGroupSearchBehavior?: RadioGroupBehavior;
	sortGroups?: boolean;
	match?: SearchMatch;
}

/** "word-prefix" matches where a word of the label or a keyword starts with the query. */
export type SearchMatch = "fuzzy" | "word-prefix";

export type DeepSearchProp = boolean | DeepSearchConfig;
export type DataInputVisibility = "always" | "typing" | "hidden";

export type DataSurfacePropsWithoutHTML<TMeta = any> = WithChildren<{
	content: Array<NodeDef<TMeta>>;
	deepSearch?: DeepSearchProp;
	search?: string;
	onSearchChange?: OnChangeFn<string>;
	defaultSearch?: string;
	loop?: boolean;
	autoHighlightFirst?: boolean;
	clearSearchOnClose?: boolean;
	ref?: HTMLDivElement | null;
}>;

export type DataSurfaceProps<TMeta = any> = DataSurfacePropsWithoutHTML<TMeta> &
	Without<BitsPrimitiveDivAttributes, DataSurfacePropsWithoutHTML<TMeta>>;

export type DataInputPropsWithoutHTML = {
	value?: string;
	onValueChange?: OnChangeFn<string>;
	visibility?: DataInputVisibility;
	hideUntilActive?: boolean;
	ref?: HTMLInputElement | null;
};

export type DataInputProps = DataInputPropsWithoutHTML &
	Without<BitsPrimitiveInputAttributes, DataInputPropsWithoutHTML>;

export type DataListChildrenSnippetProps<TMeta = any> = {
	search: string;
	nodes: Array<DisplayNode<TMeta>>;
	count: number;
	isDeepSearching: boolean;
};

export type DataListPropsWithoutHTML<TMeta = any> = Expand<
	{
		children?: Snippet<[DataListChildrenSnippetProps<TMeta>]>;
		ref?: HTMLDivElement | null;
	}
>;

export type DataListProps<TMeta = any> = DataListPropsWithoutHTML<TMeta> &
	Without<BitsPrimitiveDivAttributes, DataListPropsWithoutHTML<TMeta>>;

export type DataEmptyPropsWithoutHTML = WithChildren<{
	ref?: HTMLDivElement | null;
}>;

export type DataEmptyProps = DataEmptyPropsWithoutHTML &
	Without<BitsPrimitiveDivAttributes, DataEmptyPropsWithoutHTML>;
