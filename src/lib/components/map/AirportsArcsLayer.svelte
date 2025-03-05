<script lang="ts">
  import type { PickingInfo, Color } from '@deck.gl/core';
  import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
  import { onMount, onDestroy } from 'svelte';
  import {
    Box,
    getId,
    getMapContext,
    setPopupTarget,
    updatedDeckGlContext,
    Popup,
  } from 'svelte-maplibre';

  import { AirportPopup, ArcPopup } from '.';

  import {
    type FlightData,
    prepareFlightArcData,
    prepareVisitedAirports,
  } from '$lib/utils';
  import { isSmallScreen } from '$lib/utils/size';

  const AIRPORT_COLOR = (alpha: number): Color => [16, 185, 129, alpha]; // Tailwind emerald-500
  const INACTIVE_COLOR = (alpha: number): Color => [113, 113, 122, alpha];
  const FROM_COLOR = [59, 130, 246]; // Also the primary color
  const TO_COLOR = [139, 92, 246]; // TW violet-500
  const HOVER_COLOR = [16, 185, 129];
  const FUTURE_COLOR = [102, 217, 239, 100];

  let {
    flights,
    flightArcs,
  }: {
    flights: FlightData[];
    flightArcs: ReturnType<typeof prepareFlightArcData>;
  } = $props();

  const visitedAirports = $derived.by(() => {
    const data = flights;
    if (!data || !data.length) return [];

    return prepareVisitedAirports(data);
  });

  type VisitedAirport = (typeof visitedAirports)[0];
  type FlightArc = (typeof flightArcs)[0];

  let id = getId('deckgl-layer');
  let hoveredAirport: VisitedAirport | undefined = $state.raw(undefined);
  let hoveredArc: FlightArc | undefined = $state.raw(undefined);

  const context = getMapContext();
  const { map, loaded } = $derived(context);

  let deckgl: typeof import('@deck.gl/mapbox') | undefined = $state();
  onMount(async () => {
    deckgl = await import('@deck.gl/mapbox');
  });

  const { layer: layerId, layerEvent } = updatedDeckGlContext();
  layerId.value = id;
  setPopupTarget(new Box(undefined));

  const handleAirportHover = (e: PickingInfo<VisitedAirport>) => {
    hoveredAirport = e.object ?? undefined;
    const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
    layerEvent.value = {
      ...e,
      layerType: 'deckgl',
      type,
    };
  };

  const handleArcHover = (e: PickingInfo<FlightArc>) => {
    hoveredArc = e.object ?? undefined;
    const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
    layerEvent.value = {
      ...e,
      layerType: 'deckgl',
      type,
    };
  };

  let layer: import('@deck.gl/mapbox').MapboxOverlay | undefined = $state();

  onDestroy(() => {
    if (loaded && layer) {
      map.removeControl(layer);
    }
  });

  $effect(() => {
    layerId.value = id;
  });

  const getAirportFillColor = () => {
    return (airport: (typeof visitedAirports)[number]): Color => {
      if (hoveredAirport == airport) {
        return AIRPORT_COLOR(80);
      } else if (
        hoveredAirport?.flights.some((f) => f.airports.includes(airport.code))
      ) {
        return AIRPORT_COLOR(50);
      } else if (
        hoveredArc?.from.code === airport.code ||
        hoveredArc?.to.code === airport.code
      ) {
        return AIRPORT_COLOR(50);
      } else if (hoveredArc) {
        return INACTIVE_COLOR(50);
      } else if (hoveredAirport) {
        return INACTIVE_COLOR(50);
      } else {
        return AIRPORT_COLOR(50);
      }
    };
  };

  const getAirportLineColor = () => {
    return (airport: (typeof visitedAirports)[number]): Color => {
      if (
        hoveredAirport?.code === airport.code ||
        hoveredAirport?.flights.some((f) => f.airports.includes(airport.code))
      ) {
        return AIRPORT_COLOR(255);
      } else if (hoveredAirport) {
        return INACTIVE_COLOR(255);
      } else if (
        hoveredArc?.from.code === airport.code ||
        hoveredArc?.to.code === airport.code
      ) {
        return AIRPORT_COLOR(255);
      } else if (hoveredArc) {
        return INACTIVE_COLOR(255);
      } else {
        return AIRPORT_COLOR(255);
      }
    };
  };

  const getArcColor = (point: 'source' | 'target') => {
    return (d: (typeof flightArcs)[number]) => {
      if (hoveredArc?.from === d.from && hoveredArc?.to === d.to) {
        return HOVER_COLOR;
      } else if (hoveredArc) {
        return INACTIVE_COLOR(200);
      } else if (
        hoveredAirport?.code === d.from.code ||
        hoveredAirport?.code === d.to.code
      ) {
        return point === 'source' ? FROM_COLOR : TO_COLOR;
      } else if (hoveredAirport) {
        return INACTIVE_COLOR(200);
      } else if (d.exclusivelyFuture) {
        return FUTURE_COLOR;
      } else {
        return point === 'source' ? FROM_COLOR : TO_COLOR;
      }
    };
  };

  const airportOptions = $derived({
    id: 'scatterplot-layer',
    data: visitedAirports,
    getPosition: (airport: VisitedAirport) => [airport.lon, airport.lat],
    getRadius: (airport: VisitedAirport) => airport.frequency * 50_000,
    radiusMinPixels: $isSmallScreen ? 20 : 10,
    radiusMaxPixels: 100,
    lineWidthUnits: 'pixels',
    getLineWidth: 1,
    pickable: true,
    onHover: handleAirportHover,
    getFillColor: getAirportFillColor(),
    getLineColor: getAirportLineColor(),
    updateTriggers: {
      getFillColor: [hoveredArc, hoveredAirport],
      getLineColor: [hoveredArc, hoveredAirport],
    },
    stroked: true,
  });

  const arcOptions = $derived({
    id: 'arc-layer',
    data: flightArcs,
    getSourcePosition: (data: FlightArc) => [data.from.lon, data.from.lat],
    getTargetPosition: (data: FlightArc) => [data.to.lon, data.to.lat],
    getSourceColor: getArcColor('source'),
    getTargetColor: getArcColor('target'),
    updateTriggers: {
      getSourceColor: [hoveredArc, hoveredAirport],
      getTargetColor: [hoveredArc, hoveredAirport],
    },
    getWidth: 2,
    getHeight: 0,
    greatCircle: true,
  });

  // Actual interactivity is recorded from this (invisible) arc, while the visible arc is for display
  // This allows for a larger hover area while keeping the visual arc thin
  const ghostArcOptions = $derived({
    id: 'ghost-arc',
    data: flightArcs,
    getSourcePosition: (data: FlightArc) => [data.from.lon, data.from.lat],
    getTargetPosition: (data: FlightArc) => [data.to.lon, data.to.lat],
    getSourceColor: [0, 0, 0, 0],
    getTargetColor: [0, 0, 0, 0],
    pickable: true,
    onHover: handleArcHover,
    getWidth: 3 * 6,
    getHeight: 0,
    greatCircle: true,
  });

  $effect(() => {
    if (loaded && map && deckgl && !layer) {
      layer = new deckgl.MapboxOverlay({
        id,
        layers: [
          new ScatterplotLayer<VisitedAirport>(airportOptions),
          new ArcLayer(arcOptions),
          new ArcLayer(ghostArcOptions),
        ],
      });
      map.addControl(layer);
    }
  });

  $effect(() => {
    layer?.setProps({
      layers: [
        new ScatterplotLayer<VisitedAirport>(airportOptions),
        new ArcLayer(arcOptions),
        new ArcLayer(ghostArcOptions),
      ],
    });
  });
</script>

{#if layer}
  <Popup openOn="hover" anchor="top-left" offset={20}>
    {#snippet children({ data })}
      {#if data?.country}
        <AirportPopup {data} />
      {:else if data?.from}
        <ArcPopup {data} />
      {/if}
    {/snippet}
  </Popup>
{/if}
