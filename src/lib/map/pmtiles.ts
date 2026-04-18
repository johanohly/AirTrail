import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

let registrations = 0;
let protocol: Protocol | null = null;

export const registerPmtilesProtocol = () => {
  if (registrations === 0) {
    protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }

  registrations += 1;

  return () => {
    registrations = Math.max(0, registrations - 1);
    if (registrations === 0) {
      maplibregl.removeProtocol('pmtiles');
      protocol = null;
    }
  };
};
