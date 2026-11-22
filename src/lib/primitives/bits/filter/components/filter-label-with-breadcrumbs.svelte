<script lang="ts">
	let {
		label,
		breadcrumbs = [],
	}: {
		label: string;
		breadcrumbs?: string[];
	} = $props();
</script>

<span>
	{#if breadcrumbs.length > 0}
		<span>{breadcrumbs.join(" / ")} / </span>
	{/if}
	<span>{label}</span>
</span>
