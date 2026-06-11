import { LayerExtension } from '@deck.gl/core';

/**
 * Hides deck geometry on the far side of the globe without using the depth
 * buffer.
 *
 * deck.gl's MapLibre integration rebuilds its own globe projection from the
 * map's view state instead of reusing MapLibre's matrices, so depth values
 * for geometry at the planet's surface never reliably match the basemap's —
 * depth-testing surface arcs/circles against the globe z-fights regardless
 * of bias. Layers using this extension should disable depth testing
 * (`depthCompare: 'always'`) and rely on this analytic cull instead: in
 * deck's globe mode, common space is a sphere centered at the origin, so a
 * surface point is visible exactly when the camera lies outside the tangent
 * plane at that point.
 *
 * The discard also runs during the picking pass, so far-side geometry is
 * not hoverable/clickable. No-ops outside globe projection mode.
 */
export class GlobeOcclusionExtension extends LayerExtension {
  static extensionName = 'GlobeOcclusionExtension';

  getShaders() {
    return {
      inject: {
        'vs:#decl': 'out float globeFacing;',
        'vs:DECKGL_FILTER_GL_POSITION': /* glsl */ `
          globeFacing = 1.0;
          if (project.projectionMode == PROJECTION_MODE_GLOBE) {
            vec3 globePosition = geometry.position.xyz;
            globeFacing = dot(globePosition, project.cameraPosition - globePosition);
          }
        `,
        'fs:#decl': 'in float globeFacing;',
        'fs:DECKGL_FILTER_COLOR': 'if (globeFacing < 0.0) discard;',
      },
    };
  }
}
