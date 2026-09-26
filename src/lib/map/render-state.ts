import type { Map } from 'maplibre-gl';

/**
 * Mirrors whether the map has finished rendering onto its container as
 * `data-map-idle`, so automation (the docs screenshot pipeline) can wait for
 * tiles and layers instead of sleeping. Returns a cleanup function.
 */
export const exposeRenderState = (map: Map) => {
  const container = map.getContainer();
  const markIdle = () => (container.dataset.mapIdle = 'true');
  const markBusy = () => (container.dataset.mapIdle = 'false');
  map.on('idle', markIdle);
  map.on('movestart', markBusy);
  map.on('sourcedataloading', markBusy);
  return () => {
    map.off('idle', markIdle);
    map.off('movestart', markBusy);
    map.off('sourcedataloading', markBusy);
  };
};
