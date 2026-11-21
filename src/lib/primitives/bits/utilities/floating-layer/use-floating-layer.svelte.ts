import {
	type Middleware,
	type Placement,
	arrow,
	autoUpdate,
	flip,
	hide,
	limitShift,
	offset,
	shift,
	size,
} from "@floating-ui/dom";
import {
	attachRef,
	cssToStyleObj,
	getWindow,
	styleToString,
	type ReadableBoxedValues,
	type ReadableBox,
	type Box,
	simpleBox,
	boxFrom,
} from "svelte-toolbelt";
import { Context, ElementSize, watch } from "runed";
import type { Arrayable, WithRefOpts } from "$lib/primitives/internal/types.js";
import { isNotNull } from "$lib/primitives/internal/is.js";
import { useId } from "$lib/primitives/internal/use-id.js";
import { useFloating } from "$lib/primitives/internal/floating-svelte/use-floating.svelte.js";
import type { Measurable, UseFloatingReturn } from "$lib/primitives/internal/floating-svelte/types.js";
import type { Direction, StyleProperties } from "$lib/primitives/shared/index.js";

export const SIDE_OPTIONS = ["top", "right", "bottom", "left"] as const;
export const ALIGN_OPTIONS = ["start", "center", "end"] as const;

const OPPOSITE_SIDE: Record<Side, Side> = {
	top: "bottom",
	right: "left",
	bottom: "top",
	left: "right",
};

function getPaddingForSide(
	padding: number | Partial<Record<Side, number>> | undefined,
	side: Side
) {
	if (typeof padding === "number") return padding;
	return padding?.[side] ?? 0;
}

function parsePixelValue(value: string) {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function replacePlacementSide(placement: Placement, side: Side) {
	const [, align] = placement.split("-");
	return (side + (align ? `-${align}` : "")) as Placement;
}

function getFloatingContentNode(floating: Element) {
	return floating.firstElementChild instanceof HTMLElement
		? floating.firstElementChild
		: floating instanceof HTMLElement
			? floating
			: null;
}

function getIntendedFloatingWidth(floating: Element, measuredWidth: number) {
	const contentNode = getFloatingContentNode(floating);
	if (!contentNode) return measuredWidth;

	const style = contentNode.ownerDocument.defaultView?.getComputedStyle(contentNode);
	const rowWidth = style ? parsePixelValue(style.getPropertyValue("--row-width")) : 0;
	const isSubmenu =
		contentNode.hasAttribute("data-menu-sub-content") ||
		contentNode.hasAttribute("data-dropdown-menu-sub-content") ||
		contentNode.hasAttribute("data-context-menu-sub-content") ||
		contentNode.hasAttribute("data-menubar-sub-content");

	return Math.max(measuredWidth, rowWidth, isSubmenu ? 250 : 0);
}

function preferOppositeSideWithRoom(opts: {
	sideOffset: () => number;
	collisionPadding: () => number | Partial<Record<Side, number>>;
}): Middleware {
	return {
		name: "preferOppositeSideWithRoom",
		async fn(state) {
			const side = getSideFromPlacement(state.placement);
			if (side !== "right" && side !== "left") return {};

			const referenceNode = state.elements.reference;
			if (!("getBoundingClientRect" in referenceNode)) return {};

			const referenceRect = referenceNode.getBoundingClientRect();
			const floatingNode = state.elements.floating;
			const win = getWindow(floatingNode);
			const padding = opts.collisionPadding();
			const sideOffset = opts.sideOffset();
			const desiredWidth = getIntendedFloatingWidth(floatingNode, state.rects.floating.width);
			const leftRoom = referenceRect.left - getPaddingForSide(padding, "left") - sideOffset;
			const rightRoom =
				win.innerWidth -
				referenceRect.right -
				getPaddingForSide(padding, "right") -
				sideOffset;
			const currentRoom = side === "right" ? rightRoom : leftRoom;
			const oppositeSide = OPPOSITE_SIDE[side];
			const oppositeRoom = oppositeSide === "right" ? rightRoom : leftRoom;

			if (currentRoom >= desiredWidth || oppositeRoom < desiredWidth) return {};

			return {
				reset: {
					placement: replacePlacementSide(state.placement, oppositeSide),
				},
			};
		},
	};
}

const FloatingRootContext = new Context<FloatingRootState>("Floating.Root");
const FloatingContentContext = new Context<FloatingContentState>("Floating.Content");
const FloatingTooltipRootContext = new Context<FloatingRootState>("Floating.Root");

export type Side = (typeof SIDE_OPTIONS)[number];
export type Align = (typeof ALIGN_OPTIONS)[number];

export type Boundary = Element | null;

export class FloatingRootState {
	static create(tooltip = false) {
		return tooltip
			? FloatingTooltipRootContext.set(new FloatingRootState())
			: FloatingRootContext.set(new FloatingRootState());
	}
	anchorNode = simpleBox<Measurable | HTMLElement | null>(null);
	customAnchorNode = simpleBox<Measurable | HTMLElement | null | string>(null);
	triggerNode: ReadableBox<Measurable | HTMLElement | null> = simpleBox(null);

	constructor() {
		$effect(() => {
			if (this.customAnchorNode.current) {
				if (typeof this.customAnchorNode.current === "string") {
					this.anchorNode.current = document.querySelector(this.customAnchorNode.current);
				} else {
					this.anchorNode.current = this.customAnchorNode.current;
				}
			} else {
				this.anchorNode.current = this.triggerNode.current;
			}
		});
	}
}

export interface FloatingContentStateOpts
	extends ReadableBoxedValues<{
		id: string;
		wrapperId: string;
		side: Side;
		sideOffset: number;
		align: Align;
		alignOffset: number;
		arrowPadding: number;
		avoidCollisions: boolean;
		collisionAvoidance:
			| {
					side?: "flip" | "shift" | "none";
					align?: "shift" | "none";
			  }
			| undefined;
		collisionBoundary: Arrayable<Boundary>;
		collisionPadding: number | Partial<Record<Side, number>>;
		sticky: "partial" | "always";
		hideWhenDetached: boolean;
		updatePositionStrategy: "optimized" | "always";
		strategy: "fixed" | "absolute";
		onPlaced: () => void;
		dir: Direction;
		style: StyleProperties | null | undefined | string;
		enabled: boolean;
		customAnchor: string | HTMLElement | null | Measurable;
	}> {}

export class FloatingContentState {
	static create(opts: FloatingContentStateOpts, tooltip = false) {
		return tooltip
			? FloatingContentContext.set(
					new FloatingContentState(opts, FloatingTooltipRootContext.get())
				)
			: FloatingContentContext.set(new FloatingContentState(opts, FloatingRootContext.get()));
	}
	readonly opts: FloatingContentStateOpts;
	readonly root: FloatingRootState;

	// nodes
	contentRef = simpleBox<HTMLElement | null>(null);
	wrapperRef = simpleBox<HTMLElement | null>(null);
	arrowRef = simpleBox<HTMLElement | null>(null);
	readonly contentAttachment = attachRef(this.contentRef);
	readonly wrapperAttachment = attachRef(this.wrapperRef);
	readonly arrowAttachment = attachRef(this.arrowRef);

	// ids
	arrowId: Box<string> = simpleBox(useId());

	#transformedStyle = $derived.by(() => {
		if (typeof this.opts.style === "string") return cssToStyleObj(this.opts.style);
		if (!this.opts.style) return {};
	});

	#updatePositionStrategy =
		undefined as unknown as FloatingContentStateOpts["updatePositionStrategy"];
	#arrowSize = new ElementSize(() => this.arrowRef.current ?? undefined);
	#arrowWidth = $derived(this.#arrowSize?.width ?? 0);
	#arrowHeight = $derived(this.#arrowSize?.height ?? 0);
	#desiredPlacement = $derived.by(
		() =>
			(this.opts.side?.current +
				(this.opts.align.current !== "center"
					? `-${this.opts.align.current}`
					: "")) as Placement
	);
	#boundary = $derived.by(() =>
		Array.isArray(this.opts.collisionBoundary.current)
			? this.opts.collisionBoundary.current
			: [this.opts.collisionBoundary.current]
	);
	hasExplicitBoundaries = $derived(this.#boundary.length > 0);
	detectOverflowOptions = $derived.by(() => ({
		padding: this.opts.collisionPadding.current,
		boundary: this.#boundary.filter(isNotNull),
		altBoundary: this.hasExplicitBoundaries,
	}));
	#availableWidth = $state<number | undefined>(undefined);
	#availableHeight = $state<number | undefined>(undefined);
	#anchorWidth = $state<number | undefined>(undefined);
	#anchorHeight = $state<number | undefined>(undefined);
	#collisionAvoidance = $derived.by(() => {
		if (this.opts.collisionAvoidance.current) return this.opts.collisionAvoidance.current;
		if (!this.opts.avoidCollisions.current) return { side: "none", align: "none" };
		return { side: "flip", align: "none" };
	});
	middleware: Middleware[] = $derived.by(
		() =>
			[
				offset({
					mainAxis: this.opts.sideOffset.current + this.#arrowHeight,
					alignmentAxis: this.opts.alignOffset.current,
				}),
				this.opts.avoidCollisions.current &&
					this.#collisionAvoidance.side === "flip" &&
					preferOppositeSideWithRoom({
						sideOffset: () => this.opts.sideOffset.current + this.#arrowHeight,
						collisionPadding: () => this.opts.collisionPadding.current,
					}),
				this.opts.avoidCollisions.current &&
					(this.#collisionAvoidance.side === "shift" ||
						this.#collisionAvoidance.align === "shift") &&
					shift({
						mainAxis: this.#collisionAvoidance.side === "shift",
						crossAxis: this.#collisionAvoidance.align === "shift",
						limiter:
							this.opts.sticky.current === "partial" &&
							this.#collisionAvoidance.side !== "shift"
								? limitShift()
								: undefined,
						...this.detectOverflowOptions,
					}),
				this.opts.avoidCollisions.current &&
					this.#collisionAvoidance.side === "flip" &&
					flip({ ...this.detectOverflowOptions }),
				this.opts.avoidCollisions.current &&
					this.#collisionAvoidance.side === "flip" &&
					shift({
						mainAxis: true,
						crossAxis: this.#collisionAvoidance.align === "shift",
						limiter: this.opts.sticky.current === "partial" ? limitShift() : undefined,
						...this.detectOverflowOptions,
					}),
				size({
					...this.detectOverflowOptions,
					apply: ({ rects, availableWidth, availableHeight }) => {
						const { width: anchorWidth, height: anchorHeight } = rects.reference;
						this.#availableWidth = availableWidth;
						this.#availableHeight = availableHeight;
						this.#anchorWidth = anchorWidth;
						this.#anchorHeight = anchorHeight;
					},
				}),
				this.arrowRef.current &&
					arrow({
						element: this.arrowRef.current,
						padding: this.opts.arrowPadding.current,
					}),
				transformOrigin({ arrowWidth: this.#arrowWidth, arrowHeight: this.#arrowHeight }),
				this.opts.hideWhenDetached.current &&
					hide({ strategy: "referenceHidden", ...this.detectOverflowOptions }),
			].filter(Boolean) as Middleware[]
	);
	floating: UseFloatingReturn;
	placedSide = $derived.by(() => getSideFromPlacement(this.floating.placement));
	placedAlign = $derived.by(() => getAlignFromPlacement(this.floating.placement));
	arrowX = $derived.by(() => this.floating.middlewareData.arrow?.x ?? 0);
	arrowY = $derived.by(() => this.floating.middlewareData.arrow?.y ?? 0);
	cannotCenterArrow = $derived.by(() => this.floating.middlewareData.arrow?.centerOffset !== 0);
	contentZIndex = $state<string>();
	arrowBaseSide = $derived(OPPOSITE_SIDE[this.placedSide]);
	wrapperProps = $derived.by(
		() =>
			({
				id: this.opts.wrapperId.current,
				"data-bits-floating-content-wrapper": "",
				style: {
					...this.floating.floatingStyles,
					// keep off page when measuring
					transform: this.floating.isPositioned
						? this.floating.floatingStyles.transform
						: "translate(0, -200%)",
					minWidth: "max-content",
					zIndex: this.contentZIndex,
					"--bits-floating-transform-origin": `${this.floating.middlewareData.transformOrigin?.x} ${this.floating.middlewareData.transformOrigin?.y}`,
					"--bits-floating-available-width": `${this.#availableWidth}px`,
					"--bits-floating-available-height": `${this.#availableHeight}px`,
					"--bits-floating-anchor-width": `${this.#anchorWidth}px`,
					"--bits-floating-anchor-height": `${this.#anchorHeight}px`,
					// hide the content if using the hide middleware and should be hidden
					...(this.floating.middlewareData.hide?.referenceHidden && {
						visibility: "hidden",
						"pointer-events": "none",
					}),
					...this.#transformedStyle,
				},
				// Floating UI calculates logical alignment based the `dir` attribute
				dir: this.opts.dir.current,
				...this.wrapperAttachment,
			}) as const
	);
	props = $derived.by(
		() =>
			({
				"data-side": this.placedSide,
				"data-align": this.placedAlign,
				style: styleToString({
					...this.#transformedStyle,
				}),
				...this.contentAttachment,
			}) as const
	);

	arrowStyle = $derived({
		position: "absolute",
		left: this.arrowX ? `${this.arrowX}px` : undefined,
		top: this.arrowY ? `${this.arrowY}px` : undefined,
		[this.arrowBaseSide]: 0,
		"transform-origin": {
			top: "",
			right: "0 0",
			bottom: "center 0",
			left: "100% 0",
		}[this.placedSide],
		transform: {
			top: "translateY(100%)",
			right: "translateY(50%) rotate(90deg) translateX(-50%)",
			bottom: "rotate(180deg)",
			left: "translateY(50%) rotate(-90deg) translateX(50%)",
		}[this.placedSide],
		visibility: this.cannotCenterArrow ? "hidden" : undefined,
	});

	constructor(opts: FloatingContentStateOpts, root: FloatingRootState) {
		this.opts = opts;
		this.root = root;
		this.#updatePositionStrategy = opts.updatePositionStrategy;

		if (opts.customAnchor) {
			this.root.customAnchorNode.current = opts.customAnchor.current;
		}

		watch(
			() => opts.customAnchor.current,
			(customAnchor) => {
				this.root.customAnchorNode.current = customAnchor;
			}
		);

		this.floating = useFloating({
			strategy: () => this.opts.strategy.current,
			placement: () => this.#desiredPlacement,
			middleware: () => this.middleware,
			reference: this.root.anchorNode,
			whileElementsMounted: (...args) => {
				const cleanup = autoUpdate(...args, {
					animationFrame: this.#updatePositionStrategy?.current === "always",
				});
				return cleanup;
			},
			open: () => this.opts.enabled.current,
			sideOffset: () => this.opts.sideOffset.current,
			alignOffset: () => this.opts.alignOffset.current,
		});

		$effect(() => {
			if (!this.floating.isPositioned) return;
			this.opts.onPlaced?.current();
		});

		watch(
			() => this.contentRef.current,
			(contentNode) => {
				if (!contentNode || !this.opts.enabled.current) return;
				const win = getWindow(contentNode);
				const rafId = win.requestAnimationFrame(() => {
					// avoid applying stale values when refs change quickly
					if (this.contentRef.current !== contentNode || !this.opts.enabled.current)
						return;
					const zIndex = win.getComputedStyle(contentNode).zIndex;
					if (zIndex !== this.contentZIndex) {
						this.contentZIndex = zIndex;
					}
				});

				return () => {
					win.cancelAnimationFrame(rafId);
				};
			}
		);

		$effect(() => {
			this.floating.floating.current = this.wrapperRef.current;
		});
	}
}

interface FloatingArrowStateOpts extends WithRefOpts {}

export class FloatingArrowState {
	static create(opts: FloatingArrowStateOpts) {
		return new FloatingArrowState(opts, FloatingContentContext.get());
	}
	readonly opts: FloatingArrowStateOpts;
	readonly content: FloatingContentState;

	constructor(opts: FloatingArrowStateOpts, content: FloatingContentState) {
		this.opts = opts;
		this.content = content;
	}

	readonly props = $derived.by(
		() =>
			({
				id: this.opts.id.current,
				style: this.content.arrowStyle,
				"data-side": this.content.placedSide,
				...this.content.arrowAttachment,
			}) as const
	);
}

interface FloatingAnchorStateOpts
	extends ReadableBoxedValues<{
		id: string;
		virtualEl?: Measurable | null;
		ref: Measurable | HTMLElement | null;
	}> {}

export class FloatingAnchorState {
	static create(opts: FloatingAnchorStateOpts, tooltip = false) {
		return tooltip
			? new FloatingAnchorState(opts, FloatingTooltipRootContext.get())
			: new FloatingAnchorState(opts, FloatingRootContext.get());
	}
	readonly opts: FloatingAnchorStateOpts;
	readonly root: FloatingRootState;

	constructor(opts: FloatingAnchorStateOpts, root: FloatingRootState) {
		this.opts = opts;
		this.root = root;

		if (opts.virtualEl && opts.virtualEl.current) {
			root.triggerNode = boxFrom(opts.virtualEl.current);
		} else {
			root.triggerNode = opts.ref;
		}
	}
}

//
// HELPERS
//

function transformOrigin(options: { arrowWidth: number; arrowHeight: number }): Middleware {
	return {
		name: "transformOrigin",
		options,
		fn(data) {
			const { placement, rects, middlewareData } = data;

			const cannotCenterArrow = middlewareData.arrow?.centerOffset !== 0;
			const isArrowHidden = cannotCenterArrow;
			const arrowWidth = isArrowHidden ? 0 : options.arrowWidth;
			const arrowHeight = isArrowHidden ? 0 : options.arrowHeight;

			const [placedSide, placedAlign] = getSideAndAlignFromPlacement(placement);
			const noArrowAlign = { start: "0%", center: "50%", end: "100%" }[placedAlign];

			const arrowXCenter = (middlewareData.arrow?.x ?? 0) + arrowWidth / 2;
			const arrowYCenter = (middlewareData.arrow?.y ?? 0) + arrowHeight / 2;

			let x = "";
			let y = "";

			if (placedSide === "bottom") {
				x = isArrowHidden ? noArrowAlign : `${arrowXCenter}px`;
				y = `${-arrowHeight}px`;
			} else if (placedSide === "top") {
				x = isArrowHidden ? noArrowAlign : `${arrowXCenter}px`;
				y = `${rects.floating.height + arrowHeight}px`;
			} else if (placedSide === "right") {
				x = `${-arrowHeight}px`;
				y = isArrowHidden ? noArrowAlign : `${arrowYCenter}px`;
			} else if (placedSide === "left") {
				x = `${rects.floating.width + arrowHeight}px`;
				y = isArrowHidden ? noArrowAlign : `${arrowYCenter}px`;
			}
			return { data: { x, y } };
		},
	};
}

function getSideAndAlignFromPlacement(placement: Placement) {
	const [side, align = "center"] = placement.split("-");
	return [side as Side, align as Align] as const;
}

export function getSideFromPlacement(placement: Placement) {
	return getSideAndAlignFromPlacement(placement)[0];
}

export function getAlignFromPlacement(placement: Placement) {
	return getSideAndAlignFromPlacement(placement)[1];
}
