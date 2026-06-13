<script lang="ts">
  import type { Layer, PickingInfo, Color } from '@deck.gl/core';
  import { ArcLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
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
    type Route,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import { GlobeOcclusionExtension } from '$lib/map/globe-occlusion';
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
  import type {
    FlightTrackCoordinate,
    FlightTrackRow,
  } from '$lib/track/schema';
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
    flightArcs: ReturnType<typeof prepareFlightArcData>;
    flightTracks?: FlightTrackRow[];
    tempFilters?: TempFilters;
  } = $props();

  const visitedAirports = $derived.by(() => {
    const data = flights;
    if (!data || !data.length) return [];

    return prepareVisitedAirports(data);
  });

  type VisitedAirport = (typeof visitedAirports)[0];
  type FlightArc = (typeof flightArcs)[0];
  type FlightTrackPath = FlightArc & {
    flightId: number;
    path: FlightTrackCoordinate[];
  };
  const getRouteKey = (fromId: number, toId: number) =>
    fromId <= toId ? `${fromId}:${toId}` : `${toId}:${fromId}`;

  const unwrapTrackPath = (path: FlightTrackCoordinate[]) => {
    if (!path.length) return path;
    const unwrapped: FlightTrackCoordinate[] = [path[0]!];

    for (let index = 1; index < path.length; index++) {
      const previous = unwrapped[index - 1]!;
      const current = path[index]!;
      let lon = current[0];
      while (lon - previous[0] > 180) lon -= 360;
      while (lon - previous[0] < -180) lon += 360;
      unwrapped.push(
        current[2] === undefined
          ? [lon, current[1]]
          : [lon, current[1], current[2]],
      );
    }

    return unwrapped;
  };

  // Rank routes by frequency so the full 0..1 range is always used,
  // even when one outlier route dominates absolute counts.
  const arcFrequencyPercentileByRoute = $derived.by(() => {
    const percentileByRoute: Record<string, number> = {};
    if (!flightArcs || flightArcs.length === 0) return percentileByRoute;

    const frequencies = [
      ...new Set(flightArcs.map((arc) => arc.frequency)),
    ].sort((a, b) => a - b);
    if (frequencies.length === 1) {
      for (const arc of flightArcs) {
        percentileByRoute[getRouteKey(arc.from.id, arc.to.id)] = 0;
      }
      return percentileByRoute;
    }

    const denominator = frequencies.length - 1;
    const percentileByFrequency = new Map<number, number>();

    for (const [rank, frequency] of frequencies.entries()) {
      percentileByFrequency.set(frequency, rank / denominator);
    }

    for (const arc of flightArcs) {
      percentileByRoute[getRouteKey(arc.from.id, arc.to.id)] =
        percentileByFrequency.get(arc.frequency) ?? 0;
    }

    return percentileByRoute;
  });

  const getArcFrequencyPercentile = (d: FlightArc) => {
    const routeKey = getRouteKey(d.from.id, d.to.id);
    return arcFrequencyPercentileByRoute[routeKey] ?? 0;
  };

  const flightById = $derived.by(() => {
    return new Map(flights.map((flight) => [flight.id, flight]));
  });

  const arcByRoute = $derived.by(() => {
    return new Map(
      flightArcs.map((arc) => [getRouteKey(arc.from.id, arc.to.id), arc]),
    );
  });

  const trackFlightIds = $derived.by(() => {
    return new Set(flightTracks.map((track) => track.flightId));
  });

  const fullyTrackedRouteKeys = $derived.by(() => {
    const keys = new Set<string>();
    for (const arc of flightArcs) {
      if (
        arc.flights.length > 0 &&
        arc.flights.every((flight) => trackFlightIds.has(flight.id))
      ) {
        keys.add(getRouteKey(arc.from.id, arc.to.id));
      }
    }
    return keys;
  });

  const visibleFlightArcs = $derived.by(() => {
    return flightArcs.filter(
      (arc) => !fullyTrackedRouteKeys.has(getRouteKey(arc.from.id, arc.to.id)),
    );
  });

  const flightTrackPaths = $derived.by(() => {
    const paths: FlightTrackPath[] = [];
    for (const track of flightTracks) {
      const flight = flightById.get(track.flightId);
      if (!flight?.from || !flight.to) continue;

      const arc = arcByRoute.get(getRouteKey(flight.from.id, flight.to.id));
      if (!arc) continue;

      paths.push({
        ...arc,
        flightId: track.flightId,
        path: unwrapTrackPath(track.coordinates),
      });
    }
    return paths;
  });

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

    syncMapProjection();
    (map.on as any)('projectiontransition', syncMapProjection);
    map.on('styledata', syncMapProjection);

    return () => {
      (map.off as any)('projectiontransition', syncMapProjection);
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
      } else if (routeMatches(d, selectedRoute)) {
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
    return routeMatches(d, selectedRoute) ? Math.max(width + 1.5, 3) : width;
  };

  const airportOptions = $derived.by(() => {
    const mode = mapPreferences.airportCircles;
    const preset =
      mode === 'off' ? AIRPORT_CIRCLE_SIZE.large : AIRPORT_CIRCLE_SIZE[mode];
    const baseUnits = $isMediumScreen ? 50_000 : 100_000;
    return {
      id: 'scatterplot-layer',
      parameters: isGlobe
        ? GLOBE_AIRPORT_PARAMETERS
        : MERCATOR_AIRPORT_PARAMETERS,
      extensions: [globeOcclusion],
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

  const getTrackColor = () => {
    const baseArcColor = getBaseArcColor('source');

    return (d: FlightTrackPath): Color => {
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

  const pathOptions = $derived.by(() => ({
    id: 'track-path-layer',
    parameters: isGlobe ? GLOBE_ARC_PARAMETERS : MERCATOR_ROUTE_PARAMETERS,
    extensions: [globeOcclusion],
    data: flightTrackPaths,
    getPath: (data: FlightTrackPath) => data.path,
    getColor: getTrackColor(),
    getWidth: getVisibleArcWidth,
    widthUnits: 'pixels',
    rounded: true,
    jointRounded: true,
    capRounded: true,
    updateTriggers: {
      getColor: [
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
  }));

  const ghostPathOptions = $derived({
    id: 'ghost-track-path',
    parameters: isGlobe ? GLOBE_ARC_PARAMETERS : MERCATOR_ROUTE_PARAMETERS,
    extensions: [globeOcclusion],
    data: flightTrackPaths,
    getPath: (data: FlightTrackPath) => data.path,
    getColor: [0, 0, 0, 0],
    getWidth: 3 * 6,
    widthUnits: 'pixels',
    pickable: true,
    onHover: handleTrackHover,
    onClick: handleTrackClick,
    rounded: true,
    jointRounded: true,
    capRounded: true,
  });

  const buildLayers = () => {
    const layers: Layer[] = [];
    layers.push(new ArcLayer(arcOptions));
    layers.push(new ArcLayer(ghostArcOptions));
    layers.push(new PathLayer<FlightTrackPath>(pathOptions));
    layers.push(new PathLayer<FlightTrackPath>(ghostPathOptions));
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
