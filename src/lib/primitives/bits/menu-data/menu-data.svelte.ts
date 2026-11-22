import { Context, watch } from "runed";
import { afterTick, onDestroyEffect } from "svelte-toolbelt";
import { untrack } from "svelte";
import { createBitsAttrs } from "$lib/primitives/internal/attrs.js";
import type {
	DeepSearchConfig,
	DeepSearchProp,
	DataInputVisibility,
	DisplayNode,
	NodeDef,
	RadioGroupBehavior,
	GroupBehavior,
} from "./types.js";
import { filterNodes } from "./utils.js";
import {
	useMaybeMenuContentContext,
	type MenuHighlightModality,
} from "$lib/primitives/bits/menu/menu.svelte.js";

export const dataMenuAttrs = createBitsAttrs({
	component: "menu-data",
	parts: ["surface", "input", "list", "empty"],
});

const DataMenuSurfaceContext = new Context<DataMenuSurfaceState>("DataMenu.Surface");

export function setDataMenuSurfaceContext(state: DataMenuSurfaceState) {
	return DataMenuSurfaceContext.set(state);
}

export function useDataMenuSurfaceContext<TMeta = any>() {
	return DataMenuSurfaceContext.get() as DataMenuSurfaceState<TMeta>;
}

export function resolveDeepSearchConfig(
	deepSearch: DeepSearchProp = true
): Required<DeepSearchConfig> {
	if (typeof deepSearch === "boolean") {
		return {
			enabled: deepSearch,
			minLength: 0,
			groupSearchBehavior: "preserve",
			radioGroupSearchBehavior: "preserve",
			sortGroups: true,
			match: "fuzzy",
		};
	}

	return {
		enabled: deepSearch.enabled ?? true,
		minLength: deepSearch.minLength ?? 0,
		groupSearchBehavior: deepSearch.groupSearchBehavior ?? "preserve",
		radioGroupSearchBehavior: deepSearch.radioGroupSearchBehavior ?? "preserve",
		sortGroups: deepSearch.sortGroups ?? true,
		match: deepSearch.match ?? "fuzzy",
	};
}

interface DataMenuSurfaceStateOpts<TMeta> {
	content: () => Array<NodeDef<TMeta>>;
	deepSearchConfig: () => Required<DeepSearchConfig>;
	search: () => string;
	setSearch: (value: string) => void;
	loop: () => boolean;
	autoHighlightFirst: () => boolean;
	clearSearchOnClose: () => boolean;
}

export class DataMenuSurfaceState<TMeta = any> {
	readonly opts: DataMenuSurfaceStateOpts<TMeta>;
	readonly menuContent = useMaybeMenuContentContext();
	inputActive = $state(true);
	inputVisibility = $state<DataInputVisibility>("always");
	inputNode = $state<HTMLInputElement | null>(null);
	listNode = $state<HTMLElement | null>(null);
	highlightedId = $state<string | null>(null);
	#activationPending = false;

	constructor(opts: DataMenuSurfaceStateOpts<TMeta>) {
		this.opts = opts;

		if (this.menuContent) {
			this.menuContent.virtualFocus = true;
			this.menuContent.parentMenu.root.registerDataMenuSurface({
				contentId: this.contentId,
				parentContentId: this.parentContentId,
				focusPreferred: () => this.focusPreferred(),
			});

			onDestroyEffect(() => {
				this.menuContent?.parentMenu.root.unregisterDataMenuSurface(this.contentId);
				if (this.menuContent) {
					this.menuContent.virtualFocus = false;
				}
			});

			watch(
				() => this.menuContent?.parentMenu.opts.open.current,
				(open) => {
					if (open) {
						afterTick(() => {
							if (!this.menuContent?.parentMenu.opts.open.current) return;
							if (!this.shouldAutoActivateOnOpen) return;
							this.activate();
						});
						return;
					}
					this.highlightedId = null;
					this.menuContent?.setVirtualHighlightedId(null, {
						scroll: false,
						modality: null,
					});
					this.inputActive = this.inputVisibility === "always";
					if (this.opts.clearSearchOnClose()) {
						this.opts.setSearch("");
					}
					const root = this.menuContent?.parentMenu.root;
					untrack(() => {
						if (root?.activeDataMenuContentId === this.contentId) {
							if (this.parentContentId && this.isParentMenuChainOpen) {
								root.activateDataMenuSurface(this.parentContentId);
							} else {
								root.activateDataMenuSurface(null);
							}
						}
					});
				}
			);

			$effect(() => {
				if (!this.menuContent) return;
				if (!this.menuContent.parentMenu.opts.open.current) return;
				if (!this.menuContent.parentMenu.contentNode) return;
				if (!this.shouldAutoActivateOnOpen) return;
				this.#queueActivation();
			});

			$effect(() => {
				const menuHighlightedId = this.menuContent?.highlightedId ?? null;
				if (menuHighlightedId === this.highlightedId) return;
				if (menuHighlightedId !== null && !this.navigableIds.includes(menuHighlightedId))
					return;
				this.highlightedId = menuHighlightedId;
			});
		}

		$effect(() => {
			const ids = this.navigableIds;
			if (!this.opts.autoHighlightFirst()) return;
			if (ids.length === 0) {
				this.setHighlightedId(null, { scroll: false, modality: null });
				return;
			}
			if (!this.highlightedId || !ids.includes(this.highlightedId)) {
				this.setHighlightedId(ids[0] ?? null, { scroll: false, modality: "auto" });
			}
		});
	}

	get contentId() {
		return this.menuContent?.parentMenu.contentId.current ?? "";
	}

	get parentContentId() {
		return this.menuContent?.parentMenu.parentMenu?.contentId.current ?? null;
	}

	get isActive() {
		return this.menuContent?.parentMenu.root.activeDataMenuContentId === this.contentId;
	}

	get isRootSurface() {
		return this.menuContent?.parentMenu.parentMenu === null;
	}

	get isMenuChainOpen() {
		let menu = this.menuContent?.parentMenu ?? null;
		while (menu) {
			if (!menu.opts.open.current) return false;
			menu = menu.parentMenu;
		}
		return true;
	}

	get isParentMenuChainOpen() {
		let menu = this.menuContent?.parentMenu.parentMenu ?? null;
		while (menu) {
			if (!menu.opts.open.current) return false;
			menu = menu.parentMenu;
		}
		return true;
	}

	get shouldAutoActivateOnOpen() {
		if (this.isRootSurface) return true;
		const openModality = this.menuContent?.parentMenu.pendingOpenModality;
		return openModality !== "preview";
	}

	get shouldRenderInput() {
		if (this.inputVisibility === "hidden") return false;
		if (this.inputVisibility === "always") return true;
		return this.inputActive || this.search.length > 0;
	}

	setInputVisibility(visibility: DataInputVisibility) {
		if (this.inputVisibility === visibility) return;
		this.inputVisibility = visibility;
		this.inputActive = visibility === "always";
	}

	activate() {
		const menuContent = this.menuContent;
		if (!menuContent) return;
		if (!this.isMenuChainOpen) return;
		if (menuContent.parentMenu.root.activeDataMenuContentId === this.contentId) return;
		untrack(() => {
			menuContent.parentMenu.root.activateDataMenuSurface(
				menuContent.parentMenu.contentId.current
			);
		});
	}

	#queueActivation() {
		if (this.#activationPending) return;
		this.#activationPending = true;
		afterTick(() => {
			this.#activationPending = false;
			if (!this.menuContent) return;
			if (!this.menuContent.parentMenu.opts.open.current) return;
			if (!this.menuContent.parentMenu.contentNode) return;
			if (!this.shouldAutoActivateOnOpen) return;
			this.activate();
		});
	}

	focusPreferred() {
		if (!this.isMenuChainOpen) return;
		const target = this.shouldRenderInput ? this.inputNode : null;
		(target ?? this.listNode)?.focus({ preventScroll: true });
	}

	setHighlightedId(
		id: string | null,
		opts: { scroll?: boolean; modality?: MenuHighlightModality } = {}
	) {
		this.highlightedId = id;
		this.menuContent?.setVirtualHighlightedId(id, opts);
	}

	revealInput(seed = "") {
		if (this.inputVisibility === "hidden") return false;
		this.inputActive = true;
		if (seed) this.setSearch(seed);
		afterTick(() => {
			this.activate();
			this.focusPreferred();
			if (!seed || !this.inputNode) return;
			const length = this.inputNode.value.length;
			this.inputNode.setSelectionRange(length, length);
		});
		return true;
	}

	get content() {
		return this.opts.content();
	}

	get search() {
		return this.opts.search();
	}

	setSearch(value: string) {
		this.opts.setSearch(value);
	}

	get deepSearchConfig() {
		return this.opts.deepSearchConfig();
	}

	get result(): { displayNodes: Array<DisplayNode<TMeta>>; isDeepSearching: boolean } {
		const config = this.deepSearchConfig;
		return filterNodes({
			query: this.search,
			nodes: this.content,
			highlightedId: this.highlightedId,
			deepSearch: config.enabled,
			minLength: config.minLength,
			groupSearchBehavior: config.groupSearchBehavior as GroupBehavior,
			radioGroupSearchBehavior: config.radioGroupSearchBehavior as RadioGroupBehavior,
			sortGroups: config.sortGroups,
			match: config.match,
		});
	}

	get displayNodes() {
		return this.result.displayNodes;
	}

	get isDeepSearching() {
		return this.result.isDeepSearching;
	}

	get navigableIds() {
		const ids: string[] = [];
		for (const node of this.displayNodes) {
			if ("kind" in node && node.kind === "group") {
				for (const item of node.items) {
					if (!item.node.disabled) ids.push(item.node.id);
				}
			} else if ("kind" in node && node.kind === "radio-group") {
				for (const item of node.items) {
					if (!item.node.disabled) ids.push(item.node.id);
				}
			} else if (!("kind" in node) && !node.node.disabled) {
				ids.push(node.node.id);
			}
		}
		return ids;
	}

	selectShortcut(key: string) {
		if (this.search.length > 0) return false;
		if (!this.menuContent) return false;
		const normalizedKey = key.toLowerCase();
		let shortcutId: string | null = null;

		for (const node of this.displayNodes) {
			if ("kind" in node && node.kind === "group") {
				for (const item of node.items) {
					if (
						!item.node.disabled &&
						"shortcut" in item.node &&
						item.node.shortcut?.toLowerCase() === normalizedKey
					) {
						shortcutId = item.node.id;
						break;
					}
				}
			} else if ("kind" in node && node.kind === "radio-group") {
				for (const item of node.items) {
					if (
						!item.node.disabled &&
						"shortcut" in item.node &&
						item.node.shortcut?.toLowerCase() === normalizedKey
					) {
						shortcutId = item.node.id;
						break;
					}
				}
			} else if (
				!("kind" in node) &&
				!node.node.disabled &&
				"shortcut" in node.node &&
				node.node.shortcut?.toLowerCase() === normalizedKey
			) {
				shortcutId = node.node.id;
			}

			if (shortcutId) break;
		}

		if (!shortcutId) return false;
		const target = this.menuContent
			.getCandidateNodes()
			.find((candidate) => candidate.id === shortcutId);
		if (!target) return false;

		this.setHighlightedId(shortcutId, { modality: "keyboard" });
		return this.menuContent.selectCandidate(target);
	}

	highlightNext() {
		const ids = this.navigableIds;
		if (ids.length === 0) return;
		const currentIndex = this.highlightedId ? ids.indexOf(this.highlightedId) : -1;
		const nextIndex =
			currentIndex + 1 >= ids.length
				? this.opts.loop()
					? 0
					: ids.length - 1
				: currentIndex + 1;
		this.setHighlightedId(ids[nextIndex] ?? null, { modality: "keyboard" });
	}

	highlightPrevious() {
		const ids = this.navigableIds;
		if (ids.length === 0) return;
		const currentIndex = this.highlightedId ? ids.indexOf(this.highlightedId) : -1;
		const previousIndex =
			currentIndex - 1 < 0 ? (this.opts.loop() ? ids.length - 1 : 0) : currentIndex - 1;
		this.setHighlightedId(ids[previousIndex] ?? null, { modality: "keyboard" });
	}

	highlightFirst() {
		this.setHighlightedId(this.navigableIds[0] ?? null, { modality: "keyboard" });
	}

	highlightLast() {
		const ids = this.navigableIds;
		this.setHighlightedId(ids[ids.length - 1] ?? null, { modality: "keyboard" });
	}

	openHighlightedSubmenu() {
		const item = this.menuContent?.getHighlightedCandidate();
		if (!item || !this.menuContent) {
			return false;
		}
		if (!item.hasAttribute(this.menuContent.parentMenu.root.getBitsAttr("sub-trigger"))) {
			return false;
		}
		item.click();
		return true;
	}

	selectHighlighted() {
		if (this.openHighlightedSubmenu()) return true;
		return this.menuContent?.selectCandidate() ?? false;
	}

	closeToParent() {
		if (!this.menuContent?.parentMenu.parentMenu) return false;
		this.menuContent.parentMenu.pendingOpenModality = "preview";
		this.menuContent.parentMenu.root.activateDataMenuSurface(this.parentContentId);
		return true;
	}
}
