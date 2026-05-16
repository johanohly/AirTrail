<script lang="ts">
  import type { Layer, PickingInfo, Color } from '@deck.gl/core';
  import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
  import { MapboxOverlay } from '@deck.gl/mapbox';
  import { onDestroy } from 'svelte';
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
    normalizeRoute,
    type Route,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';
  import {
    closeMapDetails,
    mapDetailsState,
    openAirportDetails,
    openRouteDetails,
  } from '$lib/state.svelte';
  import {
    type FlightData,
    prepareFlightArcData,
    prepareVisitedAirports,
  } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';
  import { isTouchDevice } from '@melt-ui/svelte/internal/helpers';

  const AIRPORT_COLOR = (alpha: number): Color => [16, 185, 129, alpha]; // Tailwind emerald-500
  const INACTIVE_COLOR = (alpha: number): Color => [113, 113, 122, alpha];
  const FROM_COLOR = [59, 130, 246]; // Also the primary color
  const TO_COLOR = [139, 92, 246]; // TW violet-500
  const HOVER_COLOR = [16, 185, 129];
  const FUTURE_COLOR = [102, 217, 239, 100];

  let {
    flights,
    flightArcs,
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    flightArcs: ReturnType<typeof prepareFlightArcData>;
    tempFilters?: TempFilters;
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
  const clickable = $derived(tempFilters !== undefined);

  const context = getMapContext();
  const { map, loaded } = $derived(context);

  const { layer: layerId, layerEvent } = updatedDeckGlContext();
  layerId.value = id;
  setPopupTarget(new Box(undefined));

  const handleAirportHover = (e: PickingInfo<VisitedAirport>) => {
    if (!isTouchDevice()) {
      hoveredAirport = e.object ?? undefined;
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        layerType: 'deckgl',
        type,
      };
    }
  };

  const handleArcHover = (e: PickingInfo<FlightArc>) => {
    if (!isTouchDevice()) {
      hoveredArc = e.object ?? undefined;
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        layerType: 'deckgl',
        type,
      };
    }
  };

  const handleAirportClick = (e: PickingInfo<VisitedAirport>) => {
    if (e.object && tempFilters) {
      openAirportDetails(e.object.id);
    }
  };

  const handleArcClick = (e: PickingInfo<FlightArc>) => {
    if (e.object && tempFilters) {
      const route = normalizeRoute(
        e.object.from.id.toString(),
        e.object.to.id.toString(),
      );
      openRouteDetails(route);
    }
  };

  const handleMapClick = (e: PickingInfo) => {
    if (!e.object && mapDetailsState.selection) {
      closeMapDetails();
    }
  };

  let layer: MapboxOverlay | undefined = $state();

  onDestroy(() => {
    if (loaded && layer) {
      map.removeControl(layer);
    }
  });

  $effect(() => {
    layerId.value = id;
  });

  const selectedAirportId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'airport' ? selection.airportId : null;
  });

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
  });

  const routeMatches = (arc: FlightArc, route: Route | null | undefined) => {
    if (!route) return false;
    const fromId = arc.from.id.toString();
    const toId = arc.to.id.toString();
    return (
      (fromId === route.a && toId === route.b) ||
      (fromId === route.b && toId === route.a)
    );
  };

  const selectedRouteAirportIds = $derived.by(() => {
    if (!selectedRoute) return [];
    return [Number(selectedRoute.a), Number(selectedRoute.b)];
  });

  const getAirportFillColor = () => {
    return (airport: (typeof visitedAirports)[number]): Color => {
      if (selectedAirportId === airport.id) {
        return AIRPORT_COLOR(110);
      } else if (selectedRouteAirportIds.includes(airport.id)) {
        return AIRPORT_COLOR(85);
      } else if (selectedRoute) {
        return INACTIVE_COLOR(45);
      } else if (hoveredAirport == airport) {
        return AIRPORT_COLOR(80);
      } else if (
        hoveredAirport?.flights.some((f) => f.airports.includes(airport.id))
      ) {
        return AIRPORT_COLOR(50);
      } else if (
        hoveredArc?.from.id === airport.id ||
        hoveredArc?.to.id === airport.id
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
      if (selectedAirportId === airport.id) {
        return AIRPORT_COLOR(255);
      } else if (selectedRouteAirportIds.includes(airport.id)) {
        return AIRPORT_COLOR(255);
      } else if (selectedRoute) {
        return INACTIVE_COLOR(230);
      } else if (
        hoveredAirport?.id === airport.id ||
        hoveredAirport?.flights.some((f) => f.airports.includes(airport.id))
      ) {
        return AIRPORT_COLOR(255);
      } else if (hoveredAirport) {
        return INACTIVE_COLOR(255);
      } else if (
        hoveredArc?.from.id === airport.id ||
        hoveredArc?.to.id === airport.id
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
      } else if (routeMatches(d, selectedRoute)) {
        return HOVER_COLOR;
      } else if (hoveredArc) {
        return INACTIVE_COLOR(200);
      } else if (
        hoveredAirport?.id === d.from.id ||
        hoveredAirport?.id === d.to.id
      ) {
        return point === 'source' ? FROM_COLOR : TO_COLOR;
      } else if (hoveredAirport) {
        return INACTIVE_COLOR(200);
      } else if (
        selectedAirportId &&
        (d.from.id === selectedAirportId || d.to.id === selectedAirportId)
      ) {
        return point === 'source' ? FROM_COLOR : TO_COLOR;
      } else if (selectedAirportId) {
        return INACTIVE_COLOR(170);
      } else if (selectedRoute) {
        return INACTIVE_COLOR(170);
      } else if (d.exclusivelyFuture) {
        return FUTURE_COLOR;
      } else {
        return point === 'source' ? FROM_COLOR : TO_COLOR;
      }
    };
  };

  const AIRPORT_CIRCLE_SIZE = {
    small: { scale: 0.4, maxPixels: 45 },
    medium: { scale: 0.7, maxPixels: 70 },
    large: { scale: 1, maxPixels: 100 },
  } as const;

  const UNIFORM_ARC_WIDTH = {
    thin: 1,
    normal: 2,
    thick: 4,
  } as const;

  const FREQUENCY_ARC_MULTIPLIER = {
    thin: 0.8,
    normal: 1.5,
    thick: 2.5,
  } as const;

  const getArcWidth = (d: FlightArc) => {
    if (mapPreferences.arcThickness === 'byFrequency') {
      return (
        d.frequency * FREQUENCY_ARC_MULTIPLIER[mapPreferences.arcThicknessScale]
      );
    }
    return UNIFORM_ARC_WIDTH[mapPreferences.arcThicknessScale];
  };

  const getVisibleArcWidth = (d: FlightArc) => {
    const width = getArcWidth(d);
    return routeMatches(d, selectedRoute) ? Math.max(width + 1.5, 3) : width;
  };

  const airportOptions = $derived.by(() => {
    const mode = mapPreferences.airportCircles;
    const preset =
      mode === 'off' ? AIRPORT_CIRCLE_SIZE.large : AIRPORT_CIRCLE_SIZE[mode];
    const baseUnits = $isMediumScreen ? 50_000 : 100_000;
    return {
      id: 'scatterplot-layer',
      data: visitedAirports,
      getPosition: (airport: VisitedAirport) => [airport.lon, airport.lat],
      getRadius: (airport: VisitedAirport) =>
        airport.frequency * baseUnits * preset.scale,
      radiusMaxPixels: preset.maxPixels,
      lineWidthUnits: 'pixels',
      getLineWidth: (airport: VisitedAirport) =>
        airport.id === selectedAirportId ||
        selectedRouteAirportIds.includes(airport.id)
          ? 2
          : 1,
      pickable: true,
      onHover: handleAirportHover,
      onClick: handleAirportClick,
      getFillColor: getAirportFillColor(),
      getLineColor: getAirportLineColor(),
      updateTriggers: {
        getFillColor: [
          hoveredArc,
          hoveredAirport,
          selectedAirportId,
          selectedRoute,
        ],
        getLineColor: [
          hoveredArc,
          hoveredAirport,
          selectedAirportId,
          selectedRoute,
        ],
        getLineWidth: [selectedAirportId, selectedRoute],
        getRadius: [mode, $isMediumScreen],
      },
      stroked: true,
    };
  });

  const arcOptions = $derived.by(() => ({
    id: 'arc-layer',
    data: flightArcs,
    getSourcePosition: (data: FlightArc) => [data.from.lon, data.from.lat],
    getTargetPosition: (data: FlightArc) => [data.to.lon, data.to.lat],
    getSourceColor: getArcColor('source'),
    getTargetColor: getArcColor('target'),
    updateTriggers: {
      getSourceColor: [
        hoveredArc,
        hoveredAirport,
        selectedAirportId,
        selectedRoute,
      ],
      getTargetColor: [
        hoveredArc,
        hoveredAirport,
        selectedAirportId,
        selectedRoute,
      ],
      getWidth: [
        mapPreferences.arcThickness,
        mapPreferences.arcThicknessScale,
        selectedRoute,
      ],
    },
    getWidth: getVisibleArcWidth,
    getHeight: 0,
    greatCircle: true,
  }));

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
    onClick: handleArcClick,
    getWidth: 3 * 6,
    getHeight: 0,
    greatCircle: true,
  });

  const buildLayers = () => {
    const layers: Layer[] = [];
    layers.push(new ArcLayer(arcOptions));
    layers.push(new ArcLayer(ghostArcOptions));
    if (mapPreferences.airportCircles !== 'off') {
      layers.push(new ScatterplotLayer<VisitedAirport>(airportOptions));
    }
    return layers;
  };

  $effect(() => {
    if (loaded && map && !layer) {
      layer = new MapboxOverlay({
        id,
        onClick: handleMapClick,
        layers: buildLayers(),
      });
      map.addControl(layer);
      // Prevent the deck.gl overlay from rendering above map controls
      if (layer._container) {
        layer._container.style.zIndex = '-1';
      }
    }
  });

  $effect(() => {
    layer?.setProps({
      onClick: handleMapClick,
      layers: buildLayers(),
    });
  });
</script>

{#if layer}
  <Popup openOn="hover" anchor="top-left" offset={20}>
    {#snippet children({ data })}
      {#if data?.country}
        <AirportPopup {data} {clickable} />
      {:else if data?.from}
        <ArcPopup {data} {clickable} />
      {/if}
    {/snippet}
  </Popup>
{/if}
