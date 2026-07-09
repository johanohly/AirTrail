import type { Layer } from '@deck.gl/core';
import { PathLayer, type PathLayerProps } from '@deck.gl/layers';

import type { FlightTrackPath } from './flight-layer-data';
import type { FlightTrackRun } from './flight-track-style';

type FlightTrackLayerOptions = {
  standard: PathLayerProps<FlightTrackPath>;
  altitude: PathLayerProps<FlightTrackRun>;
  estimatedUnderlay: PathLayerProps<FlightTrackRun>;
  estimated: PathLayerProps<FlightTrackRun>;
  interaction: PathLayerProps<FlightTrackPath>;
};

export const buildFlightTrackLayers = ({
  standard,
  altitude,
  estimatedUnderlay,
  estimated,
  interaction,
}: FlightTrackLayerOptions): Layer[] => [
  new PathLayer<FlightTrackPath>(standard),
  new PathLayer<FlightTrackRun>(altitude),
  new PathLayer<FlightTrackRun>(estimatedUnderlay),
  new PathLayer<FlightTrackRun>(estimated),
  new PathLayer<FlightTrackPath>(interaction),
];
