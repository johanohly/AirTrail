import type { WithChild, Without } from "$lib/primitives/internal/types.js";
import type { BitsPrimitiveLabelAttributes } from "$lib/primitives/shared/attributes.js";

export type LabelRootPropsWithoutHTML = WithChild;

export type LabelRootProps = LabelRootPropsWithoutHTML &
	Without<BitsPrimitiveLabelAttributes, LabelRootPropsWithoutHTML>;
