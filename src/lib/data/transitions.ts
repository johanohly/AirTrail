// List of known airline transitions
export const AIRLINE_TRANSITIONS: Record<string, string> = {
  IBK: 'NSZ', // Norwegian Air International transferred all their airplanes to Norwegian Air Sweden
  VAU: 'VOZ', // V Australia rebranded to Virgin Australia International Airlines
  PBN: 'VOZ', // Pacific Blue rebranded to Virgin Australia International Airlines
  VRD: 'ASA', // Virgin America bought by Alaska Airlines
  AWE: 'AAL', // US Airways bought by American Airlines
};

// List of known airport transitions
export const AIRPORT_TRANSITIONS: Record<string, string> = {
  EDDT: 'EDDB', // Berlin Tegel Airport closed, all traffic moved to Berlin Brandenburg Airport
};
