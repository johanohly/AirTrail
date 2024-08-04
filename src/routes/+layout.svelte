<script lang="ts">
	import '../app.css';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { trpc } from '$lib/trpc';

	const { data, children } = $props();

	const queryClient = trpc.hydrateFromServer(data.trpc);
</script>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
