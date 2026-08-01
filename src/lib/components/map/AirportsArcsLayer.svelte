<script lang="ts">
  import type { Color, Layer, PickingInfo, Position } from '@deck.gl/core';
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
  import type { NavigateFlights } from '$lib/flight-navigation';
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
    applyFlightTrackInteractionColor,
    getEstimatedTrackUnderlayColor,
    getGroundTrackCasingColor,
    resolveRouteInteraction,
  } from '$lib/map/flight-track-interaction';
  import {
    buildFlightTrackLayers,
    prepareFlightTrackLayerData,
  } from '$lib/map/flight-track-layers';
  import {
    getFlightTrackColor,
    type FlightTrackRun,
  } from '$lib/map/flight-track-style';
  import { GlobeOcclusionExtension } from '$lib/map/globe-occlusion';
  import {
    createPopupPositionController,
    getDeckPointerLngLat,
    getDeckPointerPixel,
    type DeckPointerEvent,
  } from '$lib/map/map-popup-position';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';
  import {
    closeMapDetails,
    mapDetailsState,
    openAirportDetails,
    openFlightDetails,
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
  const FUTURE_COLOR: Color = [102, 217, 239, 100];

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
    onNavigate,
  }: {
    flights: FlightData[];
    flightArcs: FlightArc[];
    flightTracks?: FlightTrackRow[];
    tempFilters?: TempFilters;
    onNavigate?: NavigateFlights;
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

  const flightById = $derived.by(() => {
    return new Map(flights.map((flight) => [flight.id, flight]));
  });

  const flightTrackLayerData = $derived.by(() =>
    prepareFlightTrackLayerData(
      flightTrackPaths,
      mapPreferences.flightTrackStyle,
    ),
  );

  let id = getId('deckgl-layer');
  let hoveredAirport: VisitedAirport | undefined = $state.raw(undefined);
  let hoveredArc: FlightArc | FlightTrackPath | undefined =
    $state.raw(undefined);
  const clickable = $derived(tempFilters !== undefined);

  const context = getMapContext();
  const { map, loaded } = $derived(context);
  const popupPosition = createPopupPositionController(() => map);

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
      mapDetailsState.hoveredFlightTrackId = null;
      hoveredAirport = e.object ?? undefined;
      popupPosition.update(getDeckPointerPixel(e, event));
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getDeckPointerLngLat(e, event, map),
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
      mapDetailsState.hoveredFlightTrackId = null;
      hoveredArc = e.object ?? undefined;
      popupPosition.update(getDeckPointerPixel(e, event));
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getDeckPointerLngLat(e, event, map),
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
      mapDetailsState.hoveredFlightTrackId = e.object?.flightId ?? null;
      hoveredArc = e.object ?? undefined;
      popupPosition.update(getDeckPointerPixel(e, event));
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getDeckPointerLngLat(e, event, map),
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
    if (!e.object || !tempFilters) return;
    const route = normalizeRoute(
      e.object.from.id.toString(),
      e.object.to.id.toString(),
    );
    // While this route's pane is open, clicking its point-to-point line opens
    // the flight list drilled down to the whole route; otherwise open (or
    // switch to) that route's details.
    if (selectedRoute && routeMatchesArc(e.object, selectedRoute)) {
      onNavigate?.({
        destination: 'list',
        focus: { type: 'route', route },
      });
    } else {
      openRouteDetails(route);
    }
  };

  const handleTrackClick = (e: PickingInfo<FlightTrackPath>) => {
    if (!e.object || !tempFilters) return;
    // While this route's pane is open, clicking a specific flight's track opens
    // its Flight Details pane (same as clicking the flight in the route pane) —
    // which isolates that flight on the map for as long as the pane is open;
    // otherwise open the route details.
    if (selectedRoute && routeMatchesArc(e.object, selectedRoute)) {
      openFlightDetails(e.object.flightId);
    } else {
      openRouteDetails(
        normalizeRoute(e.object.from.id.toString(), e.object.to.id.toString()),
      );
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
    mapDetailsState.hoveredFlightTrackId = null;
    if (loaded && layer && map) {
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

  const selectedFlightId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'flight' ? selection.flightId : null;
  });

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
  });

  // Hovering a flight row in the route pane sets mapDetailsState.hoveredFlightTrackId
  // but no map hover. Synthesise a hovered arc/track for that flight so the map
  // highlights its line the same way a direct map hover would.
  const effectiveHoveredArc = $derived.by(() => {
    if (hoveredArc) return hoveredArc;
    const id = mapDetailsState.hoveredFlightTrackId;
    if (id == null) return undefined;
    const flight = flightById.get(id);
    if (!flight?.from || !flight.to) return undefined;
    const route = normalizeRoute(
      flight.from.id.toString(),
      flight.to.id.toString(),
    );
    const arc = flightArcs.find((candidate) =>
      routeMatchesArc(candidate, route),
    );
    if (!arc) return undefined;
    // A tracked flight is emphasised via its track (carries flightId); a
    // point-to-point flight is emphasised via its route's straight arc.
    return trackFlightIds.has(id) ? { ...arc, flightId: id } : arc;
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

    return (arc: (typeof flightArcs)[number]) =>
      applyFlightTrackInteractionColor(
        getRouteInteraction(arc),
        baseArcColor(arc),
      );
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
    const width =
      selectedFlightId === null
        ? getArcWidth(d)
        : UNIFORM_ARC_WIDTH[mapPreferences.arcThicknessScale];
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
      getPosition: (airport: VisitedAirport): Position => [
        airport.lon,
        airport.lat,
      ],
      getRadius: (airport: VisitedAirport) =>
        getFrequencyScale(airport) * baseUnits * preset.scale,
      radiusMaxPixels: preset.maxPixels,
      lineWidthUnits: 'pixels' as const,
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
    getSourcePosition: (data: FlightArc): Position => [
      data.from.lon,
      data.from.lat,
    ],
    getTargetPosition: (data: FlightArc): Position => [
      data.to.lon,
      data.to.lat,
    ],
    getSourceColor: getArcColor('source'),
    getTargetColor: getArcColor('target'),
    updateTriggers: {
      getSourceColor: [
        hoveredArc,
        hoveredAirport,
        mapDetailsState.hoveredFlightTrackId,
        selectedAirportId,
        selectedRoute,
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getTargetColor: [
        hoveredArc,
        hoveredAirport,
        mapDetailsState.hoveredFlightTrackId,
        selectedAirportId,
        selectedRoute,
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getWidth: [
        mapPreferences.arcThickness,
        mapPreferences.arcThicknessScale,
        selectedFlightId,
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
    getSourcePosition: (data: FlightArc): Position => [
      data.from.lon,
      data.from.lat,
    ],
    getTargetPosition: (data: FlightArc): Position => [
      data.to.lon,
      data.to.lat,
    ],
    getSourceColor: [0, 0, 0, 0] as Color,
    getTargetColor: [0, 0, 0, 0] as Color,
    pickable: true,
    onHover: handleArcHover,
    onClick: handleArcClick,
    getWidth: 3 * 6,
    getHeight: 0,
    greatCircle: true,
  });

  const getRouteInteraction = (arc: FlightArc) =>
    resolveRouteInteraction(arc, {
      hoveredArc: effectiveHoveredArc,
      hoveredAirportId: hoveredAirport?.id,
      selectedAirportId,
      selectedRoute,
    });

  const getTrackColor = <T extends FlightArc>(
    getBaseColor?: (data: T) => Color,
  ) => {
    const baseArcColor = getBaseArcColor('source');

    return (d: T): Color => {
      return applyFlightTrackInteractionColor(
        getRouteInteraction(d),
        getBaseColor?.(d) ?? baseArcColor(d),
      );
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
      return getEstimatedTrackUnderlayColor(getRouteInteraction(run));
    };

  const getGroundCasingColor =
    () =>
    (run: FlightTrackRun): Color => {
      return getGroundTrackCasingColor(getRouteInteraction(run), isDarkMode);
    };

  const flightTrackWidthUpdateTriggers = $derived([
    mapPreferences.arcThickness,
    mapPreferences.arcThicknessScale,
    selectedFlightId,
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
        context: {
          geometry: {
            parameters: isGlobe
              ? GLOBE_ARC_PARAMETERS
              : MERCATOR_ROUTE_PARAMETERS,
            extensions: [globeOcclusion],
          },
          appearance: {
            getWidth: getVisibleArcWidth,
            getStandardColor: getTrackColor(),
            getAltitudeColor: getAltitudeTrackColor(),
            getGroundCasingColor: getGroundCasingColor(),
            getEstimatedUnderlayColor: getEstimatedUnderlayColor(),
            updateTriggers: {
              width: flightTrackWidthUpdateTriggers,
              standardColor: [
                hoveredArc,
                hoveredAirport,
                mapDetailsState.hoveredFlightTrackId,
                selectedAirportId,
                selectedRoute,
                mapPreferences.arcColor,
                arcFrequencyPercentileByRoute,
              ],
              altitudeColor: [
                hoveredArc,
                hoveredAirport,
                mapDetailsState.hoveredFlightTrackId,
                selectedAirportId,
                selectedRoute,
                isDarkMode,
              ],
            },
          },
          interaction: {
            onHover: handleTrackHover,
            onClick: handleTrackClick,
          },
        },
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
    const overlayContainer = nextLayer.getCanvas()?.parentElement;
    if (!isGlobe && overlayContainer) {
      overlayContainer.style.zIndex = '-1';
    }
  });

  $effect(() => {
    if (!layer || layerProjection !== mapPreferences.projection) return;
    layer.setProps({
      onClick: handleMapClick,
      layers: buildLayers(),
    });
  });

  const isVisitedAirport = (data: unknown): data is VisitedAirport =>
    typeof data === 'object' && data !== null && 'country' in data;

  const isFlightArc = (data: unknown): data is FlightArc =>
    typeof data === 'object' && data !== null && 'from' in data && 'to' in data;
</script>

{#if layer}
  <Popup
    openOn="hover"
    anchor="top-left"
    offset={20}
    onopen={popupPosition.setPopup}
  >
    {#snippet children({ data })}
      {#if isVisitedAirport(data)}
        <AirportPopup {data} {clickable} />
      {:else if isFlightArc(data)}
        <ArcPopup {data} {clickable} />
      {/if}
    {/snippet}
  </Popup>
{/if}
