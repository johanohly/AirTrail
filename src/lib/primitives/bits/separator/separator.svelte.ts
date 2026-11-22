import { attachRef, type ReadableBoxedValues } from "svelte-toolbelt";
import { createBitsAttrs, boolToStrTrueOrUndef } from "$lib/primitives/internal/attrs.js";
import type { RefAttachment, WithRefOpts } from "$lib/primitives/internal/types.js";
import type { Orientation } from "$lib/primitives/shared/index.js";

const separatorAttrs = createBitsAttrs({
	component: "separator",
	parts: ["root"],
});

interface SeparatorRootStateOpts
	extends WithRefOpts,
		ReadableBoxedValues<{
			orientation: Orientation;
			decorative: boolean;
		}> {}

export class SeparatorRootState {
	static create(opts: SeparatorRootStateOpts) {
		return new SeparatorRootState(opts);
	}
	readonly opts: SeparatorRootStateOpts;
	readonly attachment: RefAttachment;

	constructor(opts: SeparatorRootStateOpts) {
		this.opts = opts;
		this.attachment = attachRef(opts.ref);
	}

	readonly props = $derived.by(
		() =>
			({
				id: this.opts.id.current,
				role: this.opts.decorative.current ? "none" : "separator",
				"aria-orientation": this.opts.orientation.current,
				"aria-hidden": boolToStrTrueOrUndef(this.opts.decorative.current),
				"data-orientation": this.opts.orientation.current,
				[separatorAttrs.root]: "",
				...this.attachment,
			}) as const
	);
}
