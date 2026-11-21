import type { WithChild } from "$lib/primitives/internal/types.js";
import type { BitsPrimitiveSpanAttributes } from "$lib/primitives/shared/attributes.js";

export type ArrowPropsWithoutHTML = WithChild<{
	/**
	 * The width of the arrow in pixels.
	 *
	 * @defaultValue 10
	 */
	width?: number;

	/**
	 * The height of the arrow in pixels.
	 *
	 * @defaultValue 5
	 */
	height?: number;
}>;

export type ArrowProps = ArrowPropsWithoutHTML & BitsPrimitiveSpanAttributes;
