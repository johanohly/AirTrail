import type { WithChild, Without } from "$lib/primitives/internal/types.js";
import type { Orientation } from "$lib/primitives/shared/index.js";
import type { BitsPrimitiveDivAttributes } from "$lib/primitives/shared/attributes.js";

export type SeparatorRootPropsWithoutHTML = WithChild<{
	/**
	 * The orientation of the separator.
	 *
	 * @defaultValue "horizontal"
	 */
	orientation?: Orientation;

	/**
	 * Whether the separator is decorative and should be hidden from assistive technologies.
	 *
	 * @defaultValue false
	 */
	decorative?: boolean;
}>;

export type SeparatorRootProps = SeparatorRootPropsWithoutHTML &
	Without<BitsPrimitiveDivAttributes, SeparatorRootPropsWithoutHTML>;
