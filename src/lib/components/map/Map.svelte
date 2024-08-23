<script lang="ts">
	import { calculateBounds, linearClamped } from '$lib/utils/index.js';
	import { AIRPORTS } from '$lib/data/airports.js';
	import {
		AttributionControl,
		Control,
		ControlButton,
		ControlGroup,
		DeckGlLayer,
		GeolocateControl,
		MapLibre,
		NavigationControl,
		Popup,
	} from 'svelte-maplibre';
	import { ArcLayer, IconLayer, ScatterplotLayer } from '@deck.gl/layers';
	import { Home } from '@o7/icon/material';
	import maplibregl from 'maplibre-gl';
	import { mode } from 'mode-watcher';
	import { OnResizeEnd } from '$lib/components/helpers';
	import { prepareFlightArcData } from '$lib/utils/data';
	import type { Readable } from 'svelte/store';
	import type { APIFlight } from '$lib/db';

	const PRIMARY_COLOR = [59, 130, 246];

	let { flights, deleteFlight }: {
		flights: Readable<{ data: APIFlight[] | undefined }>;
		deleteFlight: (id: string) => void;
	} = $props();

	let map: maplibregl.Map | undefined = $state(undefined);
	const style = $derived(
		$mode === 'light'
			? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
			: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
	);

	const flightArcs = $derived.by(() => {
		const data = $flights.data;
		if (!data || !data.length) return [];

		return prepareFlightArcData(data);
	});
	const visitedAirports = $derived.by(() => {
		const data = flightArcs;
		if (!data || !data.length) return [];

		let visited: {
			position: number[];
			meta: { name: string; country: string; iata: string | null; icao: string };
			arrivals: number;
			departures: number;
			frequency: number
		}[] = [];
		data.forEach((arc) => {
			if (!visited.some((v) => v.meta.name === arc.from.name)) {
				visited.push({
					position: arc.from.position,
					meta: {
						name: arc.from.name,
						country: arc.from.country,
						iata: arc.from.iata,
						icao: arc.from.icao,
					},
					arrivals: 0,
					departures: 1,
					frequency: 0,
				});
			} else {
				visited.find((v) => v.meta.name === arc.from.name)!.departures++;
			}

			if (!visited.some((v) => v.meta.name === arc.to.name)) {
				visited.push({
					position: arc.to.position,
					meta: {
						name: arc.to.name,
						country: arc.to.country,
						iata: arc.to.iata,
						icao: arc.to.icao,
					},
					arrivals: 1,
					departures: 0,
					frequency: 0,
				});
			} else {
				visited.find((v) => v.meta.name === arc.to.name)!.arrivals++;
			}
		});

		let maxArrivals = Math.max(...visited.map(v => v.arrivals));
		let maxDepartures = Math.max(...visited.map(v => v.departures));

		const MIN_FREQUENCY = 1;
		const MAX_FREQUENCY = 5;
		visited.forEach((v) => {
			let normalizedArrivals = v.arrivals / maxArrivals;
			let normalizedDepartures = v.departures / maxDepartures;

			let normalizedFrequency = (normalizedArrivals + normalizedDepartures) / 2;

			// Scale the normalized frequency to the range between MIN_FREQUENCY and MAX_FREQUENCY
			v.frequency = Math.ceil(normalizedFrequency * (MAX_FREQUENCY - MIN_FREQUENCY)) + MIN_FREQUENCY;
		});

		return visited;
	});


	const fitFlights = () => {
		if (!map || !flightArcs) return;

		const bounds = calculateBounds(flightArcs);
		if (!bounds) return;

		map.fitBounds(bounds, {
			padding: { left: 24, right: 24, top: 36, bottom: 36 },
		});
	};

	// Fit flights whenever the flights change
	$effect(() => {
		fitFlights();
	});
</script>

<OnResizeEnd callback={fitFlights} />

<MapLibre
	on:load={() => fitFlights()}
	bind:map
	{style}
	diffStyleUpdates
	class="relative h-full"
	attributionControl={false}
>
	<AttributionControl compact={true} />
	<NavigationControl />
	<GeolocateControl />
	{#if flightArcs.length}
		<Control position="top-left">
			<ControlGroup>
				<ControlButton
					on:click={() => fitFlights()}
					title="Show all flights"
					class="text-black"
				>
					<Home />
				</ControlButton>
			</ControlGroup>
		</Control>
	{/if}

	<DeckGlLayer
		type={ArcLayer}
		data={flightArcs}
		getSourcePosition={(d) => d.from.position}
		getTargetPosition={(d) => d.to.position}
		getSourceColor={PRIMARY_COLOR}
		getTargetColor={PRIMARY_COLOR}
		getWidth={(d) => linearClamped(d.distance)}
		getHeight={0}
		greatCircle={true}
	/>
	<DeckGlLayer
		type={ArcLayer}
		data={flightArcs}
		getSourcePosition={(d) => d.from.position}
		getTargetPosition={(d) => d.to.position}
		getSourceColor={[0, 0, 0, 0]}
		getTargetColor={[0, 0, 0, 0]}
		getWidth={(d) => linearClamped(d.distance) * 8}
		getHeight={0}
		greatCircle={true}
	>
		<Popup openOn="hover" anchor="top-left" offset={12} let:data>
			<div class="flex flex-col px-3 pt-3">
				<h3 class="font-thin text-muted-foreground">Route</h3>
				<h4 class="flex items-center text-lg">
					<img src="https://flagcdn.com/{data.from.country.toLowerCase()}.svg" alt={data.from.country}
							 class="w-8 h-5 mr-2" />
					{data.from.iata} - {data.from.name}
				</h4>
				<h4 class="flex items-center text-lg">
					<img src="https://flagcdn.com/{data.to.country.toLowerCase()}.svg" alt={data.to.country}
							 class="w-8 h-5 mr-2" />
					{data.to.iata} - {data.to.name}
				</h4>
			</div>
			<div class="h-[1px] bg-muted my-3" />
			<div class="grid grid-cols-[repeat(3,_1fr)] px-3">
				<h4 class="font-semibold">
					{Math.round(data.distance)}
					<span class="font-thin text-muted-foreground">km</span>
				</h4>
				<h4 class="font-semibold">
					{data.flights.length}
					<span class="font-thin text-muted-foreground">trip{data.flights.length !== 1 ? 's' : '' }</span>
				</h4>
				<h4 class="font-semibold">
					{data.airlines.length}
					<span class="font-thin text-muted-foreground">airline{data.airlines.length !== 1 ? 's' : ''}</span>
				</h4>
			</div>
			<div class="h-[1px] bg-muted my-3" />
			<div class="px-3 pb-3">
				<div class="grid grid-cols-[repeat(3,_1fr)]">
					<h3 class="font-semibold">Route</h3>
					<h3 class="font-semibold">Date</h3>
					<h3 class="font-semibold">Airline</h3>
				</div>
				{#each data.flights.slice(0, 5) as flight}
					<div class="grid grid-cols-[repeat(3,_1fr)]">
						<h4 class="font-thin">{flight.route}</h4>
						<h4 class="font-thin">{flight.date}</h4>
						<h4 class="font-thin">{flight.airline}</h4>
					</div>
				{/each}
				{#if data.flights.length > 5}
					<h4 class="font-thin text-muted-foreground">+{data.flights.length - 5} more</h4>
				{/if}
			</div>
		</Popup>
	</DeckGlLayer>

	<DeckGlLayer
		type={ScatterplotLayer}
		data={visitedAirports}
		getPosition={(d) => d.position}
		getRadius={(d) => d.frequency * 50_000}
		radiusMinPixels={30}
		radiusMaxPixels={100}
		lineWidthUnits="pixels"
		getLineWidth={3}
		getFillColor={[...PRIMARY_COLOR, 50]}
		getLineColor={[...PRIMARY_COLOR, 255]}
		stroked
	>
		<Popup openOn="hover" anchor="top-left" offset={12} let:data>
			<div class="flex flex-col px-3 pt-3">
				<h3 class="font-thin text-muted-foreground">Airport</h3>
				<h4 class="flex items-center text-lg">
					<img src="https://flagcdn.com/{data.meta.country.toLowerCase()}.svg" alt={data.meta.country}
							 class="w-8 h-5 mr-2" />
					{data.meta.iata} - {data.meta.name}
				</h4>
			</div>
			<div class="h-[1px] bg-muted my-3" />
			<div class="grid grid-cols-[repeat(3,_1fr)] px-3">
				<h4 class="font-semibold">
					{data.departures}
					<span class="font-thin text-muted-foreground">departure{data.departures !== 1 ? 's' : ''}</span>
				</h4>
				<h4 class="font-semibold">
					{data.arrivals}
					<span class="font-thin text-muted-foreground">arrival{data.arrivals !== 1 ? 's' : '' }</span>
				</h4>
			</div>
		</Popup>
	</DeckGlLayer>

	<!-- Both the size and sizeScale don't really matter a lot, the main values are the maxPixels and minPixels, because the unit is meters -->
	<!-- <DeckGlLayer
		type={IconLayer}
		data={AIRPORTS.filter(
				(d) => !visitedAirports.some((v) => v.name === d.name),
			)}
		getPosition={(d) => [d.lon, d.lat]}
		getIcon={(d) => 'marker'}
		getColor={[255, 255, 255]}
		getSize={(d) => linearClamped(d.tier, 4, 18, 50, 100)}
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
	-->
</MapLibre>