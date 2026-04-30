<script lang="ts">
  import type { Layer, PickingInfo, Color } from '@deck.gl/core';
  import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
  import { MapboxOverlay } from '@deck.gl/mapbox';
  import { isTouchDevice } from '@melt-ui/svelte/internal/helpers';
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
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';
  import { openModalsState } from '$lib/state.svelte';
  import {
    type FlightData,
    prepareFlightArcData,
    prepareVisitedAirports,
  } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  const AIRPORT_COLOR = (alpha: number): Color => [16, 185, 129, alpha]; // Tailwind emerald-500
  const INACTIVE_COLOR = (alpha: number): Color => [113, 113, 122, alpha];
  const FROM_COLOR = [59, 130, 246]; // Also the primary color
  const TO_COLOR = [139, 92, 246]; // TW violet-500
  const HIGH_FREQUENCY_COLOR = [239, 68, 68]; // TW red-500
  const HOVER_COLOR = [16, 185, 129];
  const FUTURE_COLOR = [102, 217, 239, 100];

  const interpolateColor = (
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    t: number,
  ): Color => {
    const clampedT = Math.max(0, Math.min(1, t));
    return [
      Math.round(from[0] + (to[0] - from[0]) * clampedT),
      Math.round(from[1] + (to[1] - from[1]) * clampedT),
      Math.round(from[2] + (to[2] - from[2]) * clampedT),
    ];
  };

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
  const getRouteKey = (fromId: number, toId: number) =>
    fromId <= toId ? `${fromId}:${toId}` : `${toId}:${fromId}`;

  // Rank routes by frequency so the full 0..1 range is always used,
  // even when one outlier route dominates absolute counts.
  const arcFrequencyPercentileByRoute = $derived.by(() => {
    const percentileByRoute: Record<string, number> = {};
    if (!flightArcs || flightArcs.length === 0) return percentileByRoute;

    if (flightArcs.length === 1) {
      const onlyArc = flightArcs[0]!;
      percentileByRoute[getRouteKey(onlyArc.from.id, onlyArc.to.id)] = 1;
      return percentileByRoute;
    }

    const sorted = [...flightArcs].sort((a, b) => a.frequency - b.frequency);
    const denominator = sorted.length - 1;

    let i = 0;
    while (i < sorted.length) {
      const frequency = sorted[i]!.frequency;
      let j = i + 1;
      while (j < sorted.length && sorted[j]!.frequency === frequency) j += 1;

      const averageRank = (i + (j - 1)) / 2;
      const percentile = averageRank / denominator;

      for (let k = i; k < j; k += 1) {
        const arc = sorted[k]!;
        percentileByRoute[getRouteKey(arc.from.id, arc.to.id)] = percentile;
      }

      i = j;
    }

    return percentileByRoute;
  });

  const getArcFrequencyPercentile = (d: FlightArc) => {
    const routeKey = getRouteKey(d.from.id, d.to.id);
    return arcFrequencyPercentileByRoute[routeKey] ?? 0;
  };

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
      tempFilters.airportsEither = [e.object.id.toString()];
      tempFilters.routes = [];
      openModalsState.listFlights = true;
    }
  };

  const handleArcClick = (e: PickingInfo<FlightArc>) => {
    if (e.object && tempFilters) {
      const route = normalizeRoute(
        e.object.from.id.toString(),
        e.object.to.id.toString(),
      );
      tempFilters.routes = [route];
      tempFilters.airportsEither = [];
      openModalsState.listFlights = true;
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

  const getAirportFillColor = () => {
    return (airport: (typeof visitedAirports)[number]): Color => {
      if (hoveredAirport == airport) {
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
      if (
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
      } else if (hoveredArc) {
        return INACTIVE_COLOR(200);
      } else if (
        hoveredAirport?.id === d.from.id ||
        hoveredAirport?.id === d.to.id
      ) {
        return point === 'source' ? FROM_COLOR : TO_COLOR;
      } else if (hoveredAirport) {
        return INACTIVE_COLOR(200);
      } else if (d.exclusivelyFuture) {
        return FUTURE_COLOR;
      } else if (mapPreferences.arcColor === 'byFrequency') {
        const normalizedFreq = getArcFrequencyPercentile(d);
        const baseColor = point === 'source' ? FROM_COLOR : TO_COLOR;
        return interpolateColor(baseColor, HIGH_FREQUENCY_COLOR, normalizedFreq);
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
      const normalizedFreq = getArcFrequencyPercentile(d);
      return (
        normalizedFreq *
        3 *
        FREQUENCY_ARC_MULTIPLIER[mapPreferences.arcThicknessScale]
      );
    }
    return UNIFORM_ARC_WIDTH[mapPreferences.arcThicknessScale];
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
      getLineWidth: 1,
      pickable: true,
      onHover: handleAirportHover,
      onClick: handleAirportClick,
      getFillColor: getAirportFillColor(),
      getLineColor: getAirportLineColor(),
      updateTriggers: {
        getFillColor: [hoveredArc, hoveredAirport],
        getLineColor: [hoveredArc, hoveredAirport],
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
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getTargetColor: [
        hoveredArc,
        hoveredAirport,
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getWidth: [
        mapPreferences.arcThickness,
        mapPreferences.arcThicknessScale,
        arcFrequencyPercentileByRoute,
      ],
    },
    getWidth: getArcWidth,
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
    if (mapPreferences.airportCircles !== 'off') {
      layers.push(new ScatterplotLayer<VisitedAirport>(airportOptions));
    }
    layers.push(new ArcLayer(arcOptions));
    layers.push(new ArcLayer(ghostArcOptions));
    return layers;
  };

  $effect(() => {
    if (loaded && map && !layer) {
      layer = new MapboxOverlay({
        id,
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
