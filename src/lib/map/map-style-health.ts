import maplibregl from 'maplibre-gl';

import { registerPmtilesProtocol } from '$lib/map/pmtiles';

const HEALTH_CHECK_TIMEOUT_MS = 15_000;

const asError = (error: unknown, fallback: string) =>
  error instanceof Error
    ? error
    : new Error(
        typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
          ? error.message
          : fallback,
      );

export const loadMapStyleForHealthCheck = (
  styleUrl: string,
  timeoutMs = HEALTH_CHECK_TIMEOUT_MS,
) =>
  new Promise<void>((resolve, reject) => {
    const container = document.createElement('div');
    Object.assign(container.style, {
      height: '256px',
      insetInlineStart: '-10000px',
      opacity: '0',
      pointerEvents: 'none',
      position: 'fixed',
      top: '0',
      width: '256px',
      zIndex: '-1',
    });
    document.body.append(container);

    let map: maplibregl.Map | null = null;
    let timeoutId: number | undefined;
    let unregisterPmtiles = () => {};
    let settled = false;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      map?.remove();
      unregisterPmtiles();
      container.remove();

      if (error) {
        reject(asError(error, 'The map style failed to load.'));
      } else {
        resolve();
      }
    };

    try {
      unregisterPmtiles = registerPmtilesProtocol();
      map = new maplibregl.Map({
        attributionControl: false,
        center: [0, 0],
        container,
        interactive: false,
        zoom: 0,
      });
      map.once('error', (event) => finish(event.error));
      map.once('load', () => finish());
      timeoutId = window.setTimeout(
        () => finish(new Error('The map style load timed out.')),
        timeoutMs,
      );
      map.setStyle(styleUrl);
    } catch (error) {
      finish(error);
    }
  });
