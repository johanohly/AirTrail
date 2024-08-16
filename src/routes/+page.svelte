<script lang="ts">
	import { trpc } from '$lib/trpc';
	import { Dock, DockTooltipItem } from '$lib/components/dock';
	import { ChartColumn, GitBranchPlus, Settings, LayoutList, Trash2 } from '@o7/icon/lucide';
	import { Separator } from '$lib/components/ui/separator';
	import { mode, toggleMode } from 'mode-watcher';
	import { DeckGlLayer, MapLibre, Popup } from 'svelte-maplibre';
	import { ArcLayer, IconLayer } from '@deck.gl/layers';
	import { calculateZoomLevel, linearClamped } from '$lib/utils';
	import { AIRPORTS } from '$lib/data/airports';
	import { toast } from 'svelte-sonner';
	import { prepareFlightArcData } from '$lib/utils/data';
	import { AddFlightModal, ListFlightsModal, SettingsModal, StatisticsModal } from '$lib/components/modals';
	import { Button } from '$lib/components/ui/button';

	const PRIMARY_COLOR = [59, 130, 246];

	const PRIMARY = [
		{
			label: 'Add flight',
			icon: GitBranchPlus,
			onClick: () => {
				addFlightModalOpen = true;
			},
		},
		{
			label: 'List flights',
			icon: LayoutList,
			onClick: () => {
				listFlightsModalOpen = true;
			},
		},
		{
			label: 'Statistics',
			icon: ChartColumn,
			onClick: () => {
				statisticsModalOpen = true;
			},
		},
	];
	const SECONDARY = [
		{
			label: 'Settings',
			icon: Settings,
			onClick: () => {
				settingsModalOpen = true;
			},
		},
		/*{
			label: "FlightRadar24",
			icon: Radar,
			href: "https://flightradar24.com"
		}*/
	];

	const { data } = $props();
	const user = data.user;
	const flights = trpc.flight.list.query();

	const invalidator = {
		onSuccess: () => {
			trpc.flight.list.utils.invalidate();
		},
	};
	const deleteFlightMutation = trpc.flight.delete.mutation(invalidator);

	const style = $derived(
		$mode === 'light'
			? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
			: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json');

	const flightArcs = $derived.by(() => {
			const data = $flights.data;
			if (!data) return [];

			return prepareFlightArcData(data);
		},
	);

	const deleteFlight = async (fId: number) => {
		const toastId = toast.loading('Deleting flight...');
		try {
			await $deleteFlightMutation.mutateAsync(fId);
			toast.success('Flight deleted', { id: toastId });
		} catch (error) {
			toast.error('Failed to delete flight', { id: toastId });
		}
	};

	let addFlightModalOpen = $state(false);
	let listFlightsModalOpen = $state(false);
	let statisticsModalOpen = $state(false);
	let settingsModalOpen = $state(false);
</script>

<AddFlightModal bind:open={addFlightModalOpen} />
<ListFlightsModal bind:open={listFlightsModalOpen} {flights} />
<StatisticsModal bind:open={statisticsModalOpen} {flights} />
<SettingsModal bind:open={settingsModalOpen} {invalidator} />

<div class="relative h-[100dvh]">
	<MapLibre
		{style}
		{...calculateZoomLevel(flightArcs)}
		class="relative h-full"
		standardControls
	>
		<DeckGlLayer
			type={ArcLayer}
			data={flightArcs}
			getSourcePosition={(d) => d.from}
			getTargetPosition={(d) => d.to}
			getSourceColor={PRIMARY_COLOR}
			getTargetColor={PRIMARY_COLOR}
			getWidth={(d) => linearClamped(d.distance)}
			getHeight={0}
			greatCircle={true}
		/>
		<DeckGlLayer
			type={ArcLayer}
			data={flightArcs}
			getSourcePosition={(d) => d.from}
			getTargetPosition={(d) => d.to}
			getSourceColor={[0,0,0,0]}
			getTargetColor={[0,0,0,0]}
			getWidth={(d) => linearClamped(d.distance) * 8}
			getHeight={0}
			greatCircle={true}
		>
			<Popup openOn="click" let:data let:close>
				<div class="flex flex-col">
					<h4 class="text-lg font-semibold">
						From {data.fromName} to {data.toName}
					</h4>
					<Button onclick={() => {close(); deleteFlight(data.id)}} variant="outline" size="icon">
						<Trash2 size="20" />
					</Button>
				</div>
			</Popup>
		</DeckGlLayer>

		<!-- Both the size and sizeScale don't really matter a lot, the main values are the maxPixels and minPixels, because the unit is meters -->
		<DeckGlLayer
			type={IconLayer}
			data={AIRPORTS}
			getPosition={(d) => [d.longitude, d.latitude]}
			getIcon={(d) => "marker"}
			getColor={[255, 255, 255]}
			getSize={500}
			sizeScale={10}
			sizeMinPixels={0}
			sizeMaxPixels={30}
			sizeUnits="meters"
			iconAtlas="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png"
			iconMapping="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json"
		>
			<Popup openOn="click" let:data>
				{data.name}
			</Popup>
		</DeckGlLayer>
	</MapLibre>

	<div class="absolute top-0 left-1/2">
		<button onclick={toggleMode}>Toggle</button>
	</div>

	<div class="absolute bottom-6 left-1/2 translate-x-[-50%]">
		<Dock
			let:mouseX
			let:distance
			let:magnification
		>
			{#each PRIMARY as item}
				<DockTooltipItem {item} {mouseX} {distance} {magnification} />
			{/each}
			<Separator orientation="vertical" class="h-full w-[0.6px]" />
			{#each SECONDARY as item}
				<DockTooltipItem {item} {mouseX} {distance} {magnification} />
			{/each}
		</Dock>
	</div>
</div>
