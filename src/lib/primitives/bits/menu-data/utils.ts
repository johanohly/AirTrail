import { computeCommandScore } from "$lib/primitives/bits/command/compute-command-score.js";
import type {
	CheckboxItemDef,
	DisplayGroupNode,
	DisplayNode,
	DisplayRadioGroupNode,
	DisplayRowNode,
	GroupBehavior,
	GroupDef,
	GroupRenderContext,
	ItemDef,
	NodeDef,
	RadioGroupBehavior,
	RadioGroupDef,
	RowRenderContext,
	ScoredNode,
	SeparatorDef,
	SubmenuDef,
} from "./types.js";
import {
	isDisplayGroupNode,
	isDisplayRadioGroupNode,
	isDisplaySeparatorNode,
} from "./types.js";

export function isItemDef<TMeta>(node: NodeDef<TMeta>): node is ItemDef<TMeta> {
	return node.kind === "item";
}

export function isCheckboxItemDef<TMeta>(
	node: NodeDef<TMeta>
): node is CheckboxItemDef<TMeta> {
	return node.kind === "checkbox-item";
}

export function isSubmenuDef<TMeta>(node: NodeDef<TMeta>): node is SubmenuDef<TMeta> {
	return node.kind === "submenu";
}

export function isGroupDef<TMeta>(node: NodeDef<TMeta>): node is GroupDef<TMeta> {
	return node.kind === "group";
}

export function isRadioGroupDef<TMeta>(node: NodeDef<TMeta>): node is RadioGroupDef<TMeta> {
	return node.kind === "radio-group";
}

export function isSeparatorDef<TMeta>(node: NodeDef<TMeta>): node is SeparatorDef<TMeta> {
	return node.kind === "separator";
}

interface FlattenOptions<TMeta> {
	deep?: boolean;
	breadcrumbs?: string[];
	breadcrumbIds?: string[];
	group?: { id: string; label?: string; groupDef: GroupDef<TMeta> } | null;
	radioGroup?: { id: string; label?: string; radioGroupDef: RadioGroupDef<TMeta> } | null;
}

interface FlattenedNode<TMeta> {
	node: ItemDef<TMeta> | CheckboxItemDef<TMeta> | SubmenuDef<TMeta>;
	breadcrumbs: string[];
	breadcrumbIds: string[];
	group: { id: string; label?: string; groupDef: GroupDef<TMeta> } | null;
	radioGroup: { id: string; label?: string; radioGroupDef: RadioGroupDef<TMeta> } | null;
}

export function flattenNodes<TMeta>(
	nodes: Array<NodeDef<TMeta>>,
	options: FlattenOptions<TMeta> = {}
): Array<FlattenedNode<TMeta>> {
	const {
		deep = false,
		breadcrumbs = [],
		breadcrumbIds = [],
		group = null,
		radioGroup = null,
	} = options;
	const result: Array<FlattenedNode<TMeta>> = [];

	for (const node of nodes) {
		if (node.kind === "separator") continue;

		if (node.kind === "group") {
			if (node.hidden) continue;
			const groupInfo = { id: node.id, label: node.label, groupDef: node };
			result.push(
				...flattenNodes(node.nodes, {
					deep,
					breadcrumbs,
					breadcrumbIds,
					group: groupInfo,
					radioGroup: null,
				})
			);
			continue;
		}

		if (node.kind === "radio-group") {
			if (node.hidden) continue;
			const radioGroupInfo = { id: node.id, label: node.label, radioGroupDef: node };
			result.push(
				...flattenNodes(node.nodes, {
					deep,
					breadcrumbs,
					breadcrumbIds,
					group: null,
					radioGroup: radioGroupInfo,
				})
			);
			continue;
		}

		if (node.hidden) continue;

		if (node.kind === "item" || node.kind === "checkbox-item") {
			result.push({ node, breadcrumbs, breadcrumbIds, group, radioGroup });
			continue;
		}

		result.push({ node, breadcrumbs, breadcrumbIds, group, radioGroup });

		if (deep && node.deepSearch !== false && node.nodes) {
			result.push(
				...flattenNodes(node.nodes, {
					deep,
					breadcrumbs: [...breadcrumbs, node.title],
					breadcrumbIds: [...breadcrumbIds, node.id],
					group: null,
					radioGroup: null,
				})
			);
		}
	}

	return result;
}

export function scoreNodes<TMeta>(
	flattenedNodes: Array<FlattenedNode<TMeta>>,
	query: string
): Array<ScoredNode<TMeta>> {
	if (!query) {
		return flattenedNodes.map((node) => ({ ...node, score: 1 }));
	}

	const results: Array<ScoredNode<TMeta>> = [];

	for (const flattenedNode of flattenedNodes) {
		const label =
			flattenedNode.node.kind === "submenu"
				? (flattenedNode.node.label ?? flattenedNode.node.title)
				: flattenedNode.node.label;
		const score = computeCommandScore(label, query, flattenedNode.node.keywords);

		if (score > 0) {
			results.push({ ...flattenedNode, score });
		}
	}

	return results;
}

export function sortByScore<TMeta>(nodes: Array<ScoredNode<TMeta>>): Array<ScoredNode<TMeta>> {
	return [...nodes].sort((a, b) => b.score - a.score);
}

export function partitionByKind<TMeta>(nodes: Array<ScoredNode<TMeta>>): Array<ScoredNode<TMeta>> {
	const items = nodes.filter((n) => n.node.kind === "item" || n.node.kind === "checkbox-item");
	const submenus = nodes.filter((n) => n.node.kind === "submenu");
	return [...items, ...submenus];
}

export function deduplicateNodes<TMeta>(
	nodes: Array<ScoredNode<TMeta>>
): Array<ScoredNode<TMeta>> {
	const seen = new Set<string>();
	const result: Array<ScoredNode<TMeta>> = [];

	for (const scoredNode of nodes) {
		const compositeId = [...scoredNode.breadcrumbIds, scoredNode.node.id].join(".");
		if (seen.has(compositeId)) continue;
		seen.add(compositeId);
		result.push(scoredNode);
	}

	return result;
}

function buildRowContext<TMeta>(
	scoredNode: ScoredNode<TMeta>,
	query: string,
	highlightedId: string | null
): RowRenderContext {
	const isDeepSearchResult = scoredNode.breadcrumbs.length > 0;
	return {
		search: query ? { query, score: scoredNode.score } : null,
		breadcrumbs: scoredNode.breadcrumbs,
		isDeepSearchResult,
		highlighted: scoredNode.node.id === highlightedId,
		disabled: scoredNode.node.disabled ?? false,
		group: scoredNode.group ? { id: scoredNode.group.id, label: scoredNode.group.label } : null,
	};
}

function buildDisplayRowNode<TMeta>(
	scoredNode: ScoredNode<TMeta>,
	query: string,
	highlightedId: string | null
): DisplayRowNode<TMeta> {
	return {
		node: scoredNode.node,
		context: buildRowContext(scoredNode, query, highlightedId),
	};
}

export function buildDisplayRowNodes<TMeta>(
	scoredNodes: Array<ScoredNode<TMeta>>,
	query: string,
	highlightedId: string | null
): Array<DisplayRowNode<TMeta>> {
	return scoredNodes.map((scoredNode) => buildDisplayRowNode(scoredNode, query, highlightedId));
}

export function getBrowseNodesPreserve<TMeta>(
	nodes: Array<NodeDef<TMeta>>,
	highlightedId: string | null
): Array<DisplayNode<TMeta>> {
	const result: Array<DisplayNode<TMeta>> = [];

	for (const node of nodes) {
		if (node.kind === "separator") {
			if (!node.hidden) result.push({ kind: "separator", separator: node });
			continue;
		}

		if (node.kind === "group") {
			if (node.hidden) continue;
			const groupItems: Array<DisplayRowNode<TMeta>> = [];
			for (const child of node.nodes) {
				if (child.kind === "separator" || child.kind === "group" || child.kind === "radio-group") {
					continue;
				}
				if (child.hidden) continue;
				groupItems.push({
					node: child,
					context: {
						search: null,
						breadcrumbs: [],
						isDeepSearchResult: false,
						highlighted: child.id === highlightedId,
						disabled: child.disabled ?? false,
						group: { id: node.id, label: node.label },
					},
				});
			}
			if (groupItems.length > 0) {
				result.push({
					kind: "group",
					group: node,
					context: {
						search: null,
						matchCount: groupItems.length,
						breadcrumbs: [],
						isDeepSearchResult: false,
					},
					items: groupItems,
					bestScore: 1,
				});
			}
			continue;
		}

		if (node.kind === "radio-group") {
			if (node.hidden) continue;
			const radioItems: Array<DisplayRowNode<TMeta>> = [];
			for (const child of node.nodes) {
				if (child.hidden) continue;
				radioItems.push({
					node: child,
					context: {
						search: null,
						breadcrumbs: [],
						isDeepSearchResult: false,
						highlighted: child.id === highlightedId,
						disabled: child.disabled ?? false,
						group: null,
					},
				});
			}
			if (radioItems.length > 0) {
				result.push({
					kind: "radio-group",
					radioGroup: node,
					context: {
						search: null,
						matchCount: radioItems.length,
						breadcrumbs: [],
						isDeepSearchResult: false,
					},
					items: radioItems,
					bestScore: 1,
				});
			}
			continue;
		}

		if (node.hidden) continue;
		result.push({
			node,
			context: {
				search: null,
				breadcrumbs: [],
				isDeepSearchResult: false,
				highlighted: node.id === highlightedId,
				disabled: node.disabled ?? false,
				group: null,
			},
		});
	}

	return result;
}

export interface FilterNodesOptions<TMeta = unknown> {
	query: string;
	nodes: Array<NodeDef<TMeta>>;
	highlightedId: string | null;
	deepSearch?: boolean;
	minLength?: number;
	groupSearchBehavior?: GroupBehavior;
	radioGroupSearchBehavior?: RadioGroupBehavior;
	sortGroups?: boolean;
}

function collectAllRadioGroupItems<TMeta>(
	flattened: Array<FlattenedNode<TMeta>>,
	enabled: boolean
) {
	const allRadioGroupItems = new Map<
		string,
		{
			radioGroupDef: RadioGroupDef<TMeta>;
			items: Array<FlattenedNode<TMeta>>;
			breadcrumbs: string[];
		}
	>();

	if (!enabled) return allRadioGroupItems;

	for (const flatNode of flattened) {
		if (!flatNode.radioGroup) continue;
		const existing = allRadioGroupItems.get(flatNode.radioGroup.id);
		if (existing) {
			existing.items.push(flatNode);
		} else {
			allRadioGroupItems.set(flatNode.radioGroup.id, {
				radioGroupDef: flatNode.radioGroup.radioGroupDef,
				items: [flatNode],
				breadcrumbs: flatNode.breadcrumbs,
			});
		}
	}

	return allRadioGroupItems;
}

function buildRadioGroupDisplayNodes<TMeta>({
	radioGroupedItems,
	allRadioGroupItems,
	query,
	highlightedId,
	radioGroupSearchBehavior,
}: {
	radioGroupedItems: Map<
		string,
		{ radioGroupDef: RadioGroupDef<TMeta>; items: Array<ScoredNode<TMeta>>; breadcrumbs: string[] }
	>;
	allRadioGroupItems: Map<
		string,
		{ radioGroupDef: RadioGroupDef<TMeta>; items: Array<FlattenedNode<TMeta>>; breadcrumbs: string[] }
	>;
	query: string;
	highlightedId: string | null;
	radioGroupSearchBehavior: RadioGroupBehavior;
}): Array<DisplayRadioGroupNode<TMeta>> {
	const displayNodes: Array<DisplayRadioGroupNode<TMeta>> = [];

	if (radioGroupSearchBehavior === "flatten") return displayNodes;

	for (const [
		radioGroupId,
		{ radioGroupDef, items: matchingItems, breadcrumbs },
	] of radioGroupedItems) {
		let itemsToDisplay: Array<ScoredNode<TMeta>>;

		if (radioGroupSearchBehavior === "preserve-show-all") {
			const allItems = allRadioGroupItems.get(radioGroupId);
			if (allItems) {
				const matchingScores = new Map(matchingItems.map((item) => [item.node.id, item.score]));
				itemsToDisplay = allItems.items.map((flatNode) => ({
					node: flatNode.node,
					score: matchingScores.get(flatNode.node.id) ?? 0,
					breadcrumbs: flatNode.breadcrumbs,
					breadcrumbIds: flatNode.breadcrumbIds,
					group: flatNode.group,
					radioGroup: flatNode.radioGroup,
				}));
			} else {
				itemsToDisplay = matchingItems;
			}
		} else {
			itemsToDisplay = matchingItems;
		}

		itemsToDisplay.sort((a, b) => b.score - a.score);
		const bestScore = Math.max(...itemsToDisplay.map((item) => item.score), 0);
		const isDeepSearchResult = breadcrumbs.length > 0;
		const context: GroupRenderContext = {
			search: query ? { query, bestScore } : null,
			matchCount: matchingItems.length,
			breadcrumbs,
			isDeepSearchResult,
		};

		displayNodes.push({
			kind: "radio-group",
			radioGroup: radioGroupDef,
			context,
			items: itemsToDisplay.map((item) => buildDisplayRowNode(item, query, highlightedId)),
			bestScore,
		});
	}

	return displayNodes;
}

function filterNodesFlatten<TMeta>(options: FilterNodesOptions<TMeta>) {
	const {
		query,
		nodes,
		highlightedId,
		deepSearch = true,
		minLength = 0,
		radioGroupSearchBehavior = "preserve",
	} = options;
	const shouldDeepSearch = deepSearch && query.length >= minLength;
	const flattened = flattenNodes(nodes, { deep: shouldDeepSearch });
	const allRadioGroupItems = collectAllRadioGroupItems(
		flattened,
		radioGroupSearchBehavior === "preserve-show-all"
	);
	const scored = scoreNodes(flattened, query);
	const radioGroupedItems = new Map<
		string,
		{ radioGroupDef: RadioGroupDef<TMeta>; items: Array<ScoredNode<TMeta>>; breadcrumbs: string[] }
	>();
	const regularItems: Array<ScoredNode<TMeta>> = [];

	for (const scoredNode of scored) {
		if (scoredNode.radioGroup && radioGroupSearchBehavior !== "flatten") {
			const existing = radioGroupedItems.get(scoredNode.radioGroup.id);
			if (existing) {
				existing.items.push(scoredNode);
			} else {
				radioGroupedItems.set(scoredNode.radioGroup.id, {
					radioGroupDef: scoredNode.radioGroup.radioGroupDef,
					items: [scoredNode],
					breadcrumbs: scoredNode.breadcrumbs,
				});
			}
		} else {
			regularItems.push(scoredNode);
		}
	}

	const regularDisplayNodes = buildDisplayRowNodes(
		deduplicateNodes(partitionByKind(sortByScore(regularItems))),
		query,
		highlightedId
	);
	const radioGroupDisplayNodes = buildRadioGroupDisplayNodes({
		radioGroupedItems,
		allRadioGroupItems,
		query,
		highlightedId,
		radioGroupSearchBehavior,
	});
	const allNodes: Array<{ node: DisplayNode<TMeta>; score: number }> = [
		...regularDisplayNodes.map((node) => ({ node, score: node.context.search?.score ?? 0 })),
		...radioGroupDisplayNodes.map((node) => ({ node, score: node.bestScore })),
	];
	allNodes.sort((a, b) => b.score - a.score);

	return {
		displayNodes: allNodes.map((node) => node.node),
		isDeepSearching: shouldDeepSearch,
	};
}

function filterNodesPreserve<TMeta>(options: FilterNodesOptions<TMeta>) {
	const {
		query,
		nodes,
		highlightedId,
		deepSearch = true,
		minLength = 0,
		sortGroups = true,
		radioGroupSearchBehavior = "preserve",
	} = options;
	const shouldDeepSearch = deepSearch && query.length >= minLength;
	const flattened = flattenNodes(nodes, { deep: shouldDeepSearch });
	const allRadioGroupItems = collectAllRadioGroupItems(
		flattened,
		radioGroupSearchBehavior === "preserve-show-all"
	);
	const scored = scoreNodes(flattened, query);
	const groupedItems = new Map<
		string,
		{ groupDef: GroupDef<TMeta>; items: Array<ScoredNode<TMeta>>; breadcrumbs: string[] }
	>();
	const radioGroupedItems = new Map<
		string,
		{ radioGroupDef: RadioGroupDef<TMeta>; items: Array<ScoredNode<TMeta>>; breadcrumbs: string[] }
	>();
	const ungroupedItems: Array<ScoredNode<TMeta>> = [];

	for (const scoredNode of scored) {
		if (scoredNode.radioGroup && radioGroupSearchBehavior !== "flatten") {
			const existing = radioGroupedItems.get(scoredNode.radioGroup.id);
			if (existing) {
				existing.items.push(scoredNode);
			} else {
				radioGroupedItems.set(scoredNode.radioGroup.id, {
					radioGroupDef: scoredNode.radioGroup.radioGroupDef,
					items: [scoredNode],
					breadcrumbs: scoredNode.breadcrumbs,
				});
			}
		} else if (scoredNode.group) {
			const existing = groupedItems.get(scoredNode.group.id);
			if (existing) {
				existing.items.push(scoredNode);
			} else {
				groupedItems.set(scoredNode.group.id, {
					groupDef: scoredNode.group.groupDef,
					items: [scoredNode],
					breadcrumbs: scoredNode.breadcrumbs,
				});
			}
		} else {
			ungroupedItems.push(scoredNode);
		}
	}

	const groupDisplayNodes: Array<DisplayGroupNode<TMeta>> = [];
	for (const { groupDef, items, breadcrumbs } of groupedItems.values()) {
		items.sort((a, b) => b.score - a.score);
		const bestScore = items[0]?.score ?? 0;
		groupDisplayNodes.push({
			kind: "group",
			group: groupDef,
			context: {
				search: query ? { query, bestScore } : null,
				matchCount: items.length,
				breadcrumbs,
				isDeepSearchResult: breadcrumbs.length > 0,
			},
			items: items.map((item) => buildDisplayRowNode(item, query, highlightedId)),
			bestScore,
		});
	}

	const radioGroupDisplayNodes = buildRadioGroupDisplayNodes({
		radioGroupedItems,
		allRadioGroupItems,
		query,
		highlightedId,
		radioGroupSearchBehavior,
	});
	const ungroupedDisplayNodes = ungroupedItems
		.sort((a, b) => b.score - a.score)
		.map((item) => buildDisplayRowNode(item, query, highlightedId));
	const allNodes: Array<{ node: DisplayNode<TMeta>; score: number }> = [
		...groupDisplayNodes.map((node) => ({ node, score: node.bestScore })),
		...radioGroupDisplayNodes.map((node) => ({ node, score: node.bestScore })),
		...ungroupedDisplayNodes.map((node) => ({ node, score: node.context.search?.score ?? 0 })),
	];

	if (sortGroups) {
		allNodes.sort((a, b) => b.score - a.score);
	}

	return {
		displayNodes: allNodes.map((node) => node.node),
		isDeepSearching: shouldDeepSearch,
	};
}

export function filterNodes<TMeta>(options: FilterNodesOptions<TMeta>): {
	displayNodes: Array<DisplayNode<TMeta>>;
	isDeepSearching: boolean;
} {
	const { query, nodes, highlightedId, groupSearchBehavior = "preserve" } = options;
	if (!query) {
		return {
			displayNodes: getBrowseNodesPreserve(nodes, highlightedId),
			isDeepSearching: false,
		};
	}

	if (groupSearchBehavior === "preserve") return filterNodesPreserve(options);
	return filterNodesFlatten(options);
}

export function getNavigableIds<TMeta>(displayNodes: Array<DisplayNode<TMeta>>): string[] {
	const ids: string[] = [];

	for (const node of displayNodes) {
		if (isDisplayGroupNode(node)) {
			for (const item of node.items) {
				if (!item.node.disabled) ids.push(item.node.id);
			}
		} else if (isDisplayRadioGroupNode(node)) {
			for (const item of node.items) {
				if (!item.node.disabled) ids.push(item.node.id);
			}
		} else if (!isDisplaySeparatorNode(node) && !node.node.disabled) {
			ids.push(node.node.id);
		}
	}

	return ids;
}

export function getDisplayNodeKey<TMeta>(node: DisplayNode<TMeta>, fallbackIndex = 0) {
	if (isDisplayGroupNode(node)) return node.group.id;
	if (isDisplayRadioGroupNode(node)) return node.radioGroup.id;
	if (isDisplaySeparatorNode(node)) return node.separator.id ?? `separator-${fallbackIndex}`;
	return [...node.context.breadcrumbs, node.node.id].join(".");
}
