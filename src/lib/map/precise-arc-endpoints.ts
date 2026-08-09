import { LayerExtension } from '@deck.gl/core';

/**
 * Keeps ArcLayer's first and last great-circle vertices on their exact input
 * coordinates.
 *
 * ArcLayer normally reconstructs every great-circle vertex with fp32
 * trigonometry. At extreme zoom levels, the reconstructed endpoint can land
 * several pixels away from another layer that projects the original fp64
 * coordinate directly. This correction shifts the completed endpoint vertices
 * onto the exact projected coordinates, so the route shape and styling stay
 * unchanged.
 *
 * This shader injection relies on ArcLayer's vertex shader variables and must
 * only be attached to ArcLayer instances.
 */
export class PreciseArcEndpointsExtension extends LayerExtension {
  static extensionName = 'PreciseArcEndpointsExtension';

  getShaders() {
    return {
      inject: {
        'vs:#main-end': /* glsl */ `
          if (segmentIndex == 0.0) {
            gl_Position += project_position_to_clipspace(
              instanceSourcePositions,
              instanceSourcePositions64Low,
              vec3(0.0)
            ) - curr;
          } else if (segmentIndex == arc.numSegments - 1.0) {
            gl_Position += project_position_to_clipspace(
              instanceTargetPositions,
              instanceTargetPositions64Low,
              vec3(0.0)
            ) - curr;
          }
        `,
      },
    };
  }
}
