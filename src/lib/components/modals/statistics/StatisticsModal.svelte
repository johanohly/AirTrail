<script lang="ts">
	import type { Readable } from 'svelte/store';
	import type { APIFlight } from '$lib/db';
	import { Modal } from '$lib/components/ui/modal';
	import FlightsPerMonth from './charts/FlightsPerMonth.svelte';
	import FlightsPerWeekday from '$lib/components/modals/statistics/charts/FlightsPerWeekday.svelte';
	import StatsCard from '$lib/components/modals/statistics/StatsCard.svelte';

	let {
		open = $bindable(),
		flights,
	}: {
		open?: boolean;
		flights: Readable<{ data: APIFlight[] | undefined }>;
	} = $props();
</script>

<Modal bind:open classes="h-full overflow-y-auto !rounded-none" dialogOnly>
	<div class="flex flex-row justify-between pr-8">
		<StatsCard classes="py-4 px-8">
			<span class="text-5xl font-bold">50,000</span>
		</StatsCard>
		<StatsCard classes="py-4 px-8">
			<span class="text-5xl font-bold">50,000</span>
		</StatsCard>
		<StatsCard classes="py-4 px-8">
			<span class="text-5xl font-bold">50,000</span>
		</StatsCard>
		<StatsCard classes="py-4 px-8">
			<span class="text-5xl font-bold">50,000</span>
		</StatsCard>
		<StatsCard classes="py-4 px-8">
			<span class="text-5xl font-bold">50,000</span>
		</StatsCard>
	</div>
	<div class="flex gap-4">
		<FlightsPerMonth {flights} />
		<FlightsPerWeekday {flights} />
	</div>
</Modal>
