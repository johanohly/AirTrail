import { describe, expect, it } from 'vitest';

import { parseDrillDown } from './drill-down';

describe('parseDrillDown', () => {
  it('reads back every kind of drill-down', () => {
    for (const drillDown of [
      { kind: 'chart', chart: 'airlines', entry: 'SAS' },
      { kind: 'chart', chart: 'routes', entry: null },
      { kind: 'continent', continent: 'Europe' },
      { kind: 'punctuality', group: 'departure-airports', entry: 'CPH' },
      { kind: 'delayed-flights' },
    ]) {
      expect(parseDrillDown(drillDown)).toEqual(drillDown);
    }
  });

  it('closes the drill-down for unknown or missing state', () => {
    expect(parseDrillDown(undefined)).toBeNull();
    expect(parseDrillDown({ kind: 'chart', chart: 'toString' })).toBeNull();
    expect(parseDrillDown({ kind: 'punctuality', group: 'seats' })).toBeNull();
    expect(parseDrillDown({ activeChart: 'airlines' })).toBeNull();
  });
});
