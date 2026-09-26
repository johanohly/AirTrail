import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre 6 ships its worker as a separate module that the bundler has to
// emit, so every map in the app needs this URL set before it is created.
maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
