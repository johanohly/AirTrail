<script lang="ts">
	import { DateFieldHiddenInputState } from "../date-field.svelte.js";
	import HiddenInput from "$lib/primitives/bits/utilities/hidden-input.svelte";

	const hiddenInputState = DateFieldHiddenInputState.create();
</script>

{#if hiddenInputState.shouldRender}
	<HiddenInput {...hiddenInputState.props} />
{/if}
