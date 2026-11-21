<script lang="ts">
	import { boxWith } from "svelte-toolbelt";
	import { CommandLabelState } from "../command.svelte.js";

	import type { WithChildren } from "$lib/primitives/internal/types.js";
	import { createId } from "$lib/primitives/internal/create-id.js";
	import { mergeProps } from "svelte-toolbelt";
	import type { BitsPrimitiveLabelAttributes, WithElementRef } from "$lib/primitives/shared/index.js";

	const uid = $props.id();
	let {
		id = createId(uid),
		ref = $bindable(null),
		children,
		...restProps
	}: WithChildren<WithElementRef<BitsPrimitiveLabelAttributes>> = $props();

	const labelState = CommandLabelState.create({
		id: boxWith(() => id),
		ref: boxWith(
			() => ref,
			(v) => (ref = v)
		),
	});

	const mergedProps = $derived(mergeProps(restProps, labelState.props));
</script>

<label {...mergedProps}>
	{@render children?.()}
</label>
