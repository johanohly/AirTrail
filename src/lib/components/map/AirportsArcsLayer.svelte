<script lang="ts">
  import type { Layer, PickingInfo, Color } from '@deck.gl/core';
  import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
  import { MapboxOverlay } from '@deck.gl/mapbox';
  import { isTouchDevice } from '@melt-ui/svelte/internal/helpers';
  import { mode } from 'mode-watcher';
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
  import {
    buildArcFrequencyPercentileByRoute,
    buildFlightTrackPaths,
    findFullyTrackedRouteKeys,
    getRouteKey,
    routeMatchesArc,
    type FlightArc,
    type FlightTrackPath,
  } from '$lib/map/flight-layer-data';
  import {
    buildFlightTrackLayers,
    prepareFlightTrackLayerData,
  } from '$lib/map/flight-track-layers';
  import {
    getFlightTrackColor,
    type FlightTrackRun,
  } from '$lib/map/flight-track-style';
  import { GlobeOcclusionExtension } from '$lib/map/globe-occlusion';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';
  import {
    closeMapDetails,
    mapDetailsState,
    openAirportDetails,
    openRouteDetails,
  } from '$lib/state.svelte';
  import type { FlightTrackRow } from '$lib/track/schema';
  import { type FlightData, prepareVisitedAirports } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  const AIRPORT_COLOR = (alpha: number): Color => [16, 185, 129, alpha]; // Tailwind emerald-500
  const INACTIVE_COLOR = (alpha: number): Color => [113, 113, 122, alpha];
  const FROM_COLOR = [59, 130, 246] as const; // Also the primary color
  const TO_COLOR = [139, 92, 246] as const; // TW violet-500
  const HIGH_FREQUENCY_COLOR = [239, 68, 68] as const; // TW red-500
  const HOVER_COLOR = [16, 185, 129];
  const FUTURE_COLOR = [102, 217, 239, 100];

  const MERCATOR_ROUTE_PARAMETERS = {
    cullMode: 'none',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;
  const MERCATOR_AIRPORT_PARAMETERS = {
    cullMode: 'back',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;

  // In globe mode deck shares MapLibre's depth buffer but reconstructs its
  // own globe projection, so surface geometry can never depth-test cleanly
  // against the basemap globe (z-fighting). Depth is skipped entirely and
  // GlobeOcclusionExtension hides the far side of the globe instead.
  const GLOBE_ARC_PARAMETERS = {
    // Arc ribbons are extruded in screen space, so their winding is
    // unreliable on the globe — never cull them.
    cullMode: 'none',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;
  const GLOBE_AIRPORT_PARAMETERS = {
    cullMode: 'back',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;
  const globeOcclusion = new GlobeOcclusionExtension();
  const isDarkMode = $derived(mode.current === 'dark');

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
    flightTracks = [],
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    flightArcs: FlightArc[];
    flightTracks?: FlightTrackRow[];
    tempFilters?: TempFilters;
  } = $props();

  const visitedAirports = $derived.by(() => {
    const data = flights;
    if (!data || !data.length) return [];

    return prepareVisitedAirports(data);
  });

  type VisitedAirport = (typeof visitedAirports)[0];
  const arcFrequencyPercentileByRoute = $derived.by(() => {
    return buildArcFrequencyPercentileByRoute(flightArcs);
  });

  const getArcFrequencyPercentile = (d: FlightArc) => {
    const routeKey = getRouteKey(d.from.id, d.to.id);
    return arcFrequencyPercentileByRoute[routeKey] ?? 0;
  };

  const activeFlightTracks = $derived.by(() => {
    if (mapPreferences.routeDisplay !== 'tracks') return [];
    return flightTracks;
  });

  const trackFlightIds = $derived.by(() => {
    return new Set(activeFlightTracks.map((track) => track.flightId));
  });

  const fullyTrackedRouteKeys = $derived.by(() => {
    return findFullyTrackedRouteKeys(flightArcs, trackFlightIds);
  });

  const visibleFlightArcs = $derived.by(() => {
    return flightArcs.filter(
      (arc) => !fullyTrackedRouteKeys.has(getRouteKey(arc.from.id, arc.to.id)),
    );
  });

  const flightTrackPaths = $derived.by(() => {
    return buildFlightTrackPaths(flights, flightArcs, activeFlightTracks);
  });

  const flightTrackLayerData = $derived.by(() =>
    prepareFlightTrackLayerData(
      flightTrackPaths,
      mapPreferences.flightTrackStyle,
    ),
  );

  // deck's picking coordinate is unprojected through deck's own globe
  // viewport, which drifts from MapLibre during the globe<->mercator
  // transition zooms — anchor popups via the raw pointer position instead.
  const getPointerLngLat = (
    e: PickingInfo,
    event?: DeckPointerEvent,
  ): [number, number] | undefined => {
    const point =
      event?.srcEvent?.point ??
      event?.offsetCenter ??
      (e.pixel ? { x: e.pixel[0], y: e.pixel[1] } : undefined) ??
      (Number.isFinite(e.x) && Number.isFinite(e.y)
        ? { x: e.x, y: e.y }
        : undefined);

    if (event?.srcEvent?.lngLat) {
      return [event.srcEvent.lngLat.lng, event.srcEvent.lngLat.lat];
    }

    if (map && point) {
      const lngLat = map.unproject([point.x, point.y]);
      return [lngLat.lng, lngLat.lat];
    }

    const srcEvent = event?.srcEvent;
    if (
      map &&
      typeof srcEvent?.clientX === 'number' &&
      typeof srcEvent.clientY === 'number'
    ) {
      const rect = map.getContainer().getBoundingClientRect();
      const lngLat = map.unproject([
        srcEvent.clientX - rect.left,
        srcEvent.clientY - rect.top,
      ]);
      return [lngLat.lng, lngLat.lat];
    }

    return e.coordinate?.length
      ? ([e.coordinate[0], e.coordinate[1]] as [number, number])
      : undefined;
  };

  type DeckPointerEvent = {
    offsetCenter?: { x: number; y: number };
    srcEvent?: Event & {
      point?: { x: number; y: number };
      lngLat?: { lng: number; lat: number };
      clientX?: number;
      clientY?: number;
    };
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

  const getProjectionType = () => {
    const projection = map?.getProjection?.() as
      | { type?: string; name?: string }
      | undefined;
    return projection?.type ?? projection?.name ?? 'unknown';
  };

  const handleAirportHover = (
    e: PickingInfo<VisitedAirport>,
    event?: DeckPointerEvent,
  ) => {
    if (!isTouchDevice()) {
      hoveredAirport = e.object ?? undefined;
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getPointerLngLat(e, event),
        layerType: 'deckgl',
        type,
      };
    }
  };

  const handleArcHover = (
    e: PickingInfo<FlightArc>,
    event?: DeckPointerEvent,
  ) => {
    if (!isTouchDevice()) {
      hoveredArc = e.object ?? undefined;
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getPointerLngLat(e, event),
        layerType: 'deckgl',
        type,
      };
    }
  };

  const handleTrackHover = (
    e: PickingInfo<FlightTrackPath>,
    event?: DeckPointerEvent,
  ) => {
    if (!isTouchDevice()) {
      hoveredArc = e.object ?? undefined;
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getPointerLngLat(e, event),
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

  const handleTrackClick = (e: PickingInfo<FlightTrackPath>) => {
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
  let layerProjection: string | undefined = $state(undefined);
  let currentMapProjection = $state('unknown');
  const isGlobe = $derived(mapPreferences.projection === 'globe');

  onDestroy(() => {
    if (loaded && layer) {
      map.removeControl(layer);
    }
  });

  $effect(() => {
    layerId.value = id;
  });

  // The deck overlay must match the basemap's actual projection, which lags
  // the preference while MapLibre transitions between projections.
  $effect(() => {
    if (!map) return;

    const syncMapProjection = () => {
      currentMapProjection = getProjectionType();
    };
    const projectionEvents = map as unknown as {
      on(event: 'projectiontransition', listener: () => void): void;
      off(event: 'projectiontransition', listener: () => void): void;
    };

    syncMapProjection();
    projectionEvents.on('projectiontransition', syncMapProjection);
    map.on('styledata', syncMapProjection);

    return () => {
      projectionEvents.off('projectiontransition', syncMapProjection);
      map.off('styledata', syncMapProjection);
    };
  });

  const selectedAirportId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'airport' ? selection.airportId : null;
  });

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
  });

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

  const getBaseArcColor = (point: 'source' | 'target') => {
    return (d: FlightArc): Color => {
      if (d.exclusivelyFuture) {
        return FUTURE_COLOR;
      }
      if (mapPreferences.arcColor === 'byFrequency') {
        const normalizedFreq = getArcFrequencyPercentile(d);
        const baseColor = point === 'source' ? FROM_COLOR : TO_COLOR;
        return interpolateColor(
          baseColor,
          HIGH_FREQUENCY_COLOR,
          normalizedFreq,
        );
      }
      return point === 'source' ? FROM_COLOR : TO_COLOR;
    };
  };

  const getArcColor = (point: 'source' | 'target') => {
    const baseArcColor = getBaseArcColor(point);

    return (d: (typeof flightArcs)[number]) => {
      if (hoveredArc?.from === d.from && hoveredArc?.to === d.to) {
        return HOVER_COLOR;
      } else if (routeMatchesArc(d, selectedRoute)) {
        return HOVER_COLOR;
      } else if (hoveredArc) {
        return INACTIVE_COLOR(200);
      } else if (
        hoveredAirport?.id === d.from.id ||
        hoveredAirport?.id === d.to.id
      ) {
        return baseArcColor(d);
      } else if (hoveredAirport) {
        return INACTIVE_COLOR(200);
      } else if (
        selectedAirportId &&
        (d.from.id === selectedAirportId || d.to.id === selectedAirportId)
      ) {
        return baseArcColor(d);
      } else if (selectedAirportId) {
        return INACTIVE_COLOR(170);
      } else if (selectedRoute) {
        return INACTIVE_COLOR(170);
      } else {
        return baseArcColor(d);
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
  const UNIFORM_AIRPORT_FREQUENCY = 2;

  const getArcWidth = (d: FlightArc) => {
    if (mapPreferences.arcThickness === 'byFrequency') {
      const normalizedFreq = getArcFrequencyPercentile(d);
      const scaledFreq = 1 + normalizedFreq * 2;
      return (
        scaledFreq * FREQUENCY_ARC_MULTIPLIER[mapPreferences.arcThicknessScale]
      );
    }
    return UNIFORM_ARC_WIDTH[mapPreferences.arcThicknessScale];
  };

  const getVisibleArcWidth = (d: FlightArc) => {
    const width = getArcWidth(d);
    return routeMatchesArc(d, selectedRoute) ? Math.max(width + 1.5, 3) : width;
  };

  const airportOptions = $derived.by(() => {
    const mode = mapPreferences.airportCircles;
    const preset =
      mode === 'off' ? AIRPORT_CIRCLE_SIZE.large : AIRPORT_CIRCLE_SIZE[mode];
    const baseUnits = $isMediumScreen ? 50_000 : 100_000;
    const getFrequencyScale = (airport: VisitedAirport) =>
      mapPreferences.airportCircleRadius === 'uniform'
        ? UNIFORM_AIRPORT_FREQUENCY
        : airport.frequency;
    return {
      id: 'scatterplot-layer',
      parameters: isGlobe
        ? GLOBE_AIRPORT_PARAMETERS
        : MERCATOR_AIRPORT_PARAMETERS,
      extensions: [globeOcclusion],
      data: visitedAirports,
      getPosition: (airport: VisitedAirport) => [airport.lon, airport.lat],
      getRadius: (airport: VisitedAirport) =>
        getFrequencyScale(airport) * baseUnits * preset.scale,
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
        getRadius: [mode, mapPreferences.airportCircleRadius, $isMediumScreen],
      },
      stroked: true,
    };
  });

  const arcOptions = $derived.by(() => ({
    id: 'arc-layer',
    parameters: isGlobe ? GLOBE_ARC_PARAMETERS : MERCATOR_ROUTE_PARAMETERS,
    extensions: [globeOcclusion],
    data: visibleFlightArcs,
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
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getTargetColor: [
        hoveredArc,
        hoveredAirport,
        selectedAirportId,
        selectedRoute,
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getWidth: [
        mapPreferences.arcThickness,
        mapPreferences.arcThicknessScale,
        selectedRoute,
        arcFrequencyPercentileByRoute,
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
    parameters: isGlobe ? GLOBE_ARC_PARAMETERS : MERCATOR_ROUTE_PARAMETERS,
    extensions: [globeOcclusion],
    data: visibleFlightArcs,
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

  type TrackInteractionState = 'active' | 'highlighted' | 170 | 200;

  const getTrackInteractionState = <T extends FlightArc>(
    d: T,
  ): TrackInteractionState => {
    if (
      (hoveredArc?.from === d.from && hoveredArc?.to === d.to) ||
      routeMatchesArc(d, selectedRoute)
    ) {
      return 'highlighted';
    }
    if (hoveredArc) return 200;
    if (hoveredAirport) {
      return hoveredAirport.id === d.from.id || hoveredAirport.id === d.to.id
        ? 'active'
        : 200;
    }
    if (selectedAirportId) {
      return selectedAirportId === d.from.id || selectedAirportId === d.to.id
        ? 'active'
        : 170;
    }
    return selectedRoute ? 170 : 'active';
  };

  const getTrackColor = <T extends FlightArc>(
    getBaseColor?: (data: T) => Color,
  ) => {
    const baseArcColor = getBaseArcColor('source');

    return (d: T): Color => {
      const state = getTrackInteractionState(d);
      if (state === 'highlighted') return HOVER_COLOR;
      if (typeof state === 'number') return INACTIVE_COLOR(state);
      return getBaseColor?.(d) ?? baseArcColor(d);
    };
  };

  const getAltitudeTrackColor = () =>
    getTrackColor<FlightTrackRun>((run) =>
      getFlightTrackColor({
        altitudeFeet: run.altitudeFeet,
        ground: run.ground,
        estimated: run.estimated,
        darkMode: isDarkMode,
      }),
    );

  const getEstimatedUnderlayColor =
    () =>
    (run: FlightTrackRun): Color => {
      const state = getTrackInteractionState(run);
      return [
        24,
        24,
        27,
        typeof state === 'number' ? Math.round(state * 0.3) : 190,
      ];
    };

  const getGroundCasingColor =
    () =>
    (run: FlightTrackRun): Color => {
      const state = getTrackInteractionState(run);
      const alpha = typeof state === 'number' ? Math.round(state * 0.75) : 220;
      return isDarkMode ? [9, 9, 11, alpha] : [250, 250, 250, alpha];
    };

  const pathWidthUpdateTriggers = $derived([
    mapPreferences.arcThickness,
    mapPreferences.arcThicknessScale,
    selectedRoute,
    arcFrequencyPercentileByRoute,
  ]);

  const buildLayers = () => {
    const layers: Layer[] = [];
    layers.push(new ArcLayer(arcOptions));
    layers.push(new ArcLayer(ghostArcOptions));
    layers.push(
      ...buildFlightTrackLayers({
        data: flightTrackLayerData,
        style: mapPreferences.flightTrackStyle,
        parameters: isGlobe ? GLOBE_ARC_PARAMETERS : MERCATOR_ROUTE_PARAMETERS,
        extensions: [globeOcclusion],
        getWidth: getVisibleArcWidth,
        getStandardColor: getTrackColor(),
        getAltitudeColor: getAltitudeTrackColor(),
        getGroundCasingColor: getGroundCasingColor(),
        getEstimatedUnderlayColor: getEstimatedUnderlayColor(),
        widthUpdateTriggers: pathWidthUpdateTriggers,
        standardColorUpdateTriggers: [
          hoveredArc,
          hoveredAirport,
          selectedAirportId,
          selectedRoute,
          mapPreferences.arcColor,
          arcFrequencyPercentileByRoute,
        ],
        altitudeColorUpdateTriggers: [
          hoveredArc,
          hoveredAirport,
          selectedAirportId,
          selectedRoute,
          isDarkMode,
        ],
        onHover: handleTrackHover,
        onClick: handleTrackClick,
      }),
    );
    if (mapPreferences.airportCircles !== 'off') {
      layers.push(new ScatterplotLayer<VisitedAirport>(airportOptions));
    }
    return layers;
  };

  // Globe needs interleaved rendering (deck draws into MapLibre's canvas so
  // the planet can occlude far-side geometry); mercator keeps the original
  // separate-canvas overlay. Switching requires recreating the overlay.
  $effect(() => {
    if (!loaded || !map) return;
    if (currentMapProjection !== mapPreferences.projection) return;
    if (layer && layerProjection === mapPreferences.projection) return;

    if (layer) {
      map.removeControl(layer);
    }

    const nextLayer = new MapboxOverlay({
      id,
      interleaved: isGlobe,
      onClick: handleMapClick,
      layers: buildLayers(),
    });
    map.addControl(nextLayer);
    layer = nextLayer;
    layerProjection = mapPreferences.projection;
    // Prevent the deck.gl overlay from rendering above map controls when not interleaved.
    if (layer._container) {
      layer._container.style.zIndex = '-1';
    }
  });

  $effect(() => {
    if (!layer || layerProjection !== mapPreferences.projection) return;
    layer.setProps({
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
