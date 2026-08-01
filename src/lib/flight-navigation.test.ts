import { describe, expect, it, vi } from 'vitest';

import {
  createFlightNavigator,
  planFlightNavigation,
} from './flight-navigation';
import {
  canShowFlightOnMap,
  includeFocusedFlightInList,
  includeFocusedRouteOnMap,
} from './flight-visibility';

import { createDefaultTempFilters } from '$lib/components/flight-filters/types';

const flight = (id: number, from: number | null, to: number | null) => ({
  id,
  from: from === null ? null : { id: from },
  to: to === null ? null : { id: to },
});

const createNavigator = (statisticsOpen = false) => {
  let state = {
    tempFilters: createDefaultTempFilters(),
    focusedListFlightId: null as number | null,
    listOpen: false,
    statisticsOpen,
  };
  const events: string[] = [];
  const focusFlightInList = vi.fn();
  const openFlightDetails = vi.fn();
  const navigate = createFlightNavigator({
    getState: () => state,
    commitState: (next) => {
      state = next;
      events.push(
        `commit:list=${next.listOpen},statistics=${next.statisticsOpen}`,
      );
    },
    focusFlightInList,
    waitForModalClose: async () => {
      events.push('wait');
    },
    openFlightDetails: (flightId) => {
      openFlightDetails(flightId);
      events.push(`details:${flightId}`);
    },
  });

  return {
    navigate,
    focusFlightInList,
    openFlightDetails,
    events,
    state: () => ({
      ...state,
      statsOpen: state.statisticsOpen,
    }),
  };
};

describe('flight navigation', () => {
  it('keeps excluded flights on the focused route drawable', () => {
    const visible = [flight(1, 1, 2), flight(2, 3, 4)];
    const all = [...visible, flight(3, 2, 1), flight(4, 5, 6)];

    expect(
      includeFocusedRouteOnMap(visible, all, { a: '1', b: '2' }).map(
        (item) => item.id,
      ),
    ).toEqual([1, 2, 3]);
  });

  it('preserves the filtered array when no route is focused', () => {
    const visible = [flight(1, 1, 2)];

    expect(includeFocusedRouteOnMap(visible, visible, null)).toBe(visible);
  });

  it('includes a focused list flight outside persistent filters', () => {
    expect(
      includeFocusedFlightInList(
        [flight(1, 1, 2)],
        [flight(1, 1, 2), flight(2, 3, 4)],
        2,
      ),
    ).toMatchObject({
      focusedFlightOutsideFilters: true,
      flights: [{ id: 1 }, { id: 2 }],
    });
  });

  it('only maps flights with both endpoints', () => {
    expect(canShowFlightOnMap(flight(1, 1, 2))).toBe(true);
    expect(canShowFlightOnMap(flight(2, null, 2))).toBe(false);
    expect(canShowFlightOnMap(flight(3, 1, null))).toBe(false);
  });

  it('plans navigation without mutating the current state', () => {
    const current = {
      tempFilters: createDefaultTempFilters(),
      focusedListFlightId: null,
      listOpen: false,
      statisticsOpen: true,
    };

    const transition = planFlightNavigation(
      {
        destination: 'list',
        focus: { type: 'route', route: { a: '1', b: '2' } },
      },
      current,
    );

    expect(current.tempFilters.routes).toEqual([]);
    expect(transition.state).toMatchObject({
      listOpen: true,
      statisticsOpen: true,
      tempFilters: { routes: [{ a: '1', b: '2' }] },
    });
  });

  it('opens a route-focused list with only the route temp filter', async () => {
    const harness = createNavigator();

    await harness.navigate({
      destination: 'list',
      focus: { type: 'route', route: { a: '1', b: '2' } },
    });

    expect(harness.state()).toMatchObject({
      focusedListFlightId: null,
      listOpen: true,
      tempFilters: {
        departureAirports: [],
        arrivalAirports: [],
        airportsEither: [],
        routes: [{ a: '1', b: '2' }],
      },
    });
  });

  it.each(['departure', 'arrival'] as const)(
    'opens an airport-focused list for %s flights',
    async (direction) => {
      const harness = createNavigator();

      await harness.navigate({
        destination: 'list',
        focus: {
          type: 'airport',
          airportId: 42,
          direction,
        },
      });

      expect(harness.state()).toMatchObject({
        focusedListFlightId: null,
        listOpen: true,
        tempFilters: {
          departureAirports: direction === 'departure' ? ['42'] : [],
          arrivalAirports: direction === 'arrival' ? ['42'] : [],
          routes: [],
        },
      });
      expect(harness.focusFlightInList).not.toHaveBeenCalled();
    },
  );

  it('opens a flight-focused list outside temporary filters', async () => {
    const harness = createNavigator();

    await harness.navigate({
      destination: 'list',
      focus: { type: 'flight', flightId: 9 },
    });

    expect(harness.state()).toMatchObject({
      focusedListFlightId: 9,
      listOpen: true,
      tempFilters: createDefaultTempFilters(),
    });
    expect(harness.focusFlightInList).toHaveBeenCalledWith(9);
  });

  it('closes modal history before opening flight details on the map', async () => {
    const harness = createNavigator(true);

    await harness.navigate({
      destination: 'map',
      focus: { type: 'flight', flightId: 11 },
    });

    expect(harness.state()).toMatchObject({
      listOpen: false,
      statsOpen: false,
      tempFilters: createDefaultTempFilters(),
    });
    expect(harness.openFlightDetails).toHaveBeenCalledWith(11);
    expect(harness.events).toEqual([
      'commit:list=false,statistics=false',
      'wait',
      'details:11',
    ]);
  });
});
