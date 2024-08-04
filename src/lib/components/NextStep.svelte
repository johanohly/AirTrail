<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		title,
		learnMore,
		children,
	}: {
		title: string;
		learnMore: string;
		children: Snippet;
	} = $props();
</script>

<section class="flex w-1/3 flex-col gap-2 rounded-lg bg-zinc-800 p-4 shadow-lg">
	<h1 class="mb-2 text-xl font-bold">{title}</h1>
	{@render children()}
	<a
		href={learnMore}
		target="_blank"
		rel="noreferrer"
		class="mt-auto pt-3 text-right text-blue-400 hover:underline"
	>
		Learn more
	</a>
</section>
