import type maplibregl from 'maplibre-gl';
import type { CustomImageSpec } from 'svelte-maplibre';

export const supportsMapWebGL = () => {
  const canvas = document.createElement('canvas');

  return !!(
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')
  );
};

export const loadBooleanMapPreference = (storageKey: string) => {
  return localStorage.getItem(storageKey) === 'true';
};

export const storeBooleanMapPreference = (
  storageKey: string,
  value: boolean,
) => {
  localStorage.setItem(storageKey, value ? 'true' : 'false');
};

export const applyStyleLayerVisibility = (
  map: maplibregl.Map,
  layerIds: string[],
  visibility: 'visible' | 'none',
) => {
  for (const layerId of layerIds) {
    if (!map.getLayer(layerId)) {
      continue;
    }

    if (map.getLayoutProperty(layerId, 'visibility') === visibility) {
      continue;
    }

    map.setLayoutProperty(layerId, 'visibility', visibility);
  }
};

export const bindStyleLayerVisibility = (
  map: maplibregl.Map,
  layerIds: string[],
  visibility: 'visible' | 'none',
) => {
  const syncVisibility = () => {
    applyStyleLayerVisibility(map, layerIds, visibility);
  };

  syncVisibility();
  map.on('styledata', syncVisibility);

  return () => {
    map.off('styledata', syncVisibility);
  };
};

export const bindRuntimeMapImages = (
  map: maplibregl.Map,
  images: CustomImageSpec[],
  onError: (error: unknown) => void = console.error,
) => {
  let cancelled = false;
  const pendingImageIds = new Set<string>();

  const syncImages = (force = false) => {
    if (!map.loaded() && !force) {
      return;
    }

    for (const image of images) {
      if ('url' in image) {
        if (map.hasImage(image.id)) {
          continue;
        }

        if (pendingImageIds.has(image.id)) {
          continue;
        }

        pendingImageIds.add(image.id);

        map
          .loadImage(image.url)
          .then((imageData) => {
            if (cancelled) {
              return;
            }

            if (map.hasImage(image.id)) {
              return;
            }

            map.addImage(image.id, imageData.data, image.options);
          })
          .catch((error) => {
            if (!cancelled) {
              onError(error);
            }
          })
          .finally(() => {
            pendingImageIds.delete(image.id);
          });

        continue;
      }

      if (map.hasImage(image.id)) {
        continue;
      }

      map.addImage(image.id, image.data, image.options);
    }
  };

  syncImages();

  const handleStyleLoad = () => {
    syncImages(true);
  };

  map.on('style.load', handleStyleLoad);

  return () => {
    cancelled = true;
    map.off('style.load', handleStyleLoad);
  };
};
