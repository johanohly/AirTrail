// Pure unit conversions. No preference awareness here; see ./format.ts for that.

export const kmToMiles = (km: number) => km * 0.6213711922;
export const kmToNauticalMiles = (km: number) => km * 0.539956803;
export const feetToMeters = (feet: number) => feet * 0.3048;

export const ktToMph = (kt: number) => kt * 1.150779448;
export const ktToKmh = (kt: number) => kt * 1.852;
export const ktToMs = (kt: number) => kt * 0.514444444;

export const cToF = (c: number) => (c * 9) / 5 + 32;

export const hpaToInhg = (hpa: number) => hpa * 0.02953;
