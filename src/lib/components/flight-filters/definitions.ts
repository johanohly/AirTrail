import {
  Armchair,
  ArrowLeftRight,
  Briefcase,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Earth,
  Flag,
  Globe,
  Hash,
  LocateFixed,
  PersonStanding,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Ticket,
  Timer,
  UsersRound,
} from '@o7/icon';
import { Airlines } from '@o7/icon/material';
import type { Component } from 'svelte';

import { COUNTRIES } from '$lib/data/countries';
import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
import type { Airport, FlightPassenger } from '$lib/db/types';
import {
  ContinentMap,
  SeatClasses,
  SeatTypeLabels,
  SeatTypes,
} from '$lib/db/types';
import {
  normalizeSeatNumber,
  routeLabelForFlight,
} from '$lib/stats/aggregations';
import {
  getFlightPassengerLabel,
  getFlightPassengerToken,
  toTitleCase,
  type FlightData,
} from '$lib/utils';
import { flightReasonLabel } from '$lib/utils/flight-reasons';

/*
 * Every flight filter is one entry in `FILTER_DEFINITIONS`. The entry says
 * how to read a flight's value and how to label it, and everything else
 * (matching, options and counts, the desktop menu, the mobile screens) is
 * derived from it.
 */

export type FilterIconComponent = Component<{
  size?: number;
  class?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

export type FilterOptionIcon =
  | { kind: 'flag'; country: string }
  | { kind: 'logo'; src: string }
  | { kind: 'avatar'; username: string };

export type FilterOption = {
  value: string;
  label: string;
  shortLabel?: string;
  /** Secondary text, like the route a flight number flies. */
  description?: string;
  keywords?: string[];
  icon?: FilterOptionIcon;
  count: number;
};

type OptionDetails = Omit<FilterOption, 'value' | 'count'>;

/** Whose passenger rows the seat and reason filters read. */
export type FilterScope = {
  /** Picked by an inclusive passenger filter. */
  passengerTokens?: string[];
  /** The user whose flights are shown, unless all users' are. */
  seatUserId?: string;
};

type FlightValue = string | number | null | undefined;

export const FILTER_GROUPS = [
  { id: 'location', label: 'Location' },
  { id: 'date', label: 'Date' },
  { id: 'airline', label: 'Airline & aircraft' },
  { id: 'flight', label: 'Flight' },
  { id: 'seat', label: 'Seat' },
  { id: 'people', label: 'People' },
] as const;

export type FilterGroupId = (typeof FILTER_GROUPS)[number]['id'];

type BaseDefinition = {
  label: string;
  /** For "2 departure countries", when adding an "s" isn't right. */
  plural?: string;
  group: FilterGroupId;
  icon: FilterIconComponent;
};

export type OptionFilterDefinition = BaseDefinition & {
  kind: 'option';
  id: string;
  /** A flight holds several values at once, so include/exclude operators apply. */
  multi?: boolean;
  /** A map drilldown picks the airports itself, so this filter steps aside. */
  replacedByDrilldown?: boolean;
  values: (
    flight: FlightData,
    scope: FilterScope,
  ) => FlightValue[] | FlightValue;
  describe?: (value: string, flight: FlightData) => OptionDetails;
  /** Every possible option, in display order. */
  known?: readonly Omit<FilterOption, 'count'>[];
  compare?: (a: FilterOption, b: FilterOption) => number;
};

export type DateFilterDefinition = BaseDefinition & {
  kind: 'date';
  id: 'date';
};

const COUNTRY_NAMES = new Map(
  COUNTRIES.map((country) => [country.alpha2, country.name]),
);

const HOUR = 3600;

const durationBucket = (seconds: number | null) => {
  if (!seconds) return null;
  if (seconds < 3 * HOUR) return 'short';
  if (seconds < 6 * HOUR) return 'medium';
  if (seconds < 12 * HOUR) return 'long';
  return 'ultralong';
};

const airportOption = (airport: Airport | null): OptionDetails => {
  const code = airport?.iata ?? airport?.icao ?? '';
  return {
    label: `${code} | ${airport?.name ?? ''}`,
    shortLabel: code,
    keywords: [airport?.iata, airport?.icao].filter((k): k is string => !!k),
    icon: airport?.country
      ? { kind: 'flag', country: airport.country }
      : undefined,
  };
};

const countryOption = (code: string): OptionDetails => {
  const name = COUNTRY_NAMES.get(code.toUpperCase()) ?? code;
  return {
    label: name,
    keywords: [code],
    icon: { kind: 'flag', country: code },
  };
};

const continentOptions = Object.entries(ContinentMap).map(([value, label]) => ({
  value,
  label,
}));

/*
 * The passenger rows the seat and reason filters read: those picked by an
 * inclusive passenger filter, else the shown user's row, else every row.
 */
const scopedPassengers = (
  flight: FlightData,
  scope: FilterScope,
): FlightPassenger[] => {
  const { passengerTokens, seatUserId } = scope;
  if (passengerTokens) {
    return flight.passengers.filter((passenger) =>
      passengerTokens.includes(getFlightPassengerToken(passenger) ?? ''),
    );
  }
  if (seatUserId) {
    return flight.passengers.filter(
      (passenger) => passenger.userId === seatUserId,
    );
  }
  return flight.passengers;
};

const routeKey = (flight: FlightData) => {
  if (!flight.from || !flight.to) return null;
  const [a, b] = [flight.from.id, flight.to.id].sort((x, y) => x - y);
  return `${a}|${b}`;
};

const byValueDescending = (a: FilterOption, b: FilterOption) =>
  b.value.localeCompare(a.value);

const byValueNatural = (a: FilterOption, b: FilterOption) =>
  a.value.localeCompare(b.value, undefined, { numeric: true });

export const FILTER_DEFINITIONS = [
  {
    kind: 'option',
    id: 'route',
    label: 'Route',
    group: 'location',
    icon: ArrowLeftRight,
    values: routeKey,
    describe: (_, flight) => ({ label: routeLabelForFlight(flight) ?? '' }),
  },
  {
    kind: 'option',
    id: 'departureAirports',
    label: 'Departure airport',
    group: 'location',
    icon: PlaneTakeoff,
    replacedByDrilldown: true,
    values: (flight) => flight.from?.id,
    describe: (_, flight) => airportOption(flight.from),
  },
  {
    kind: 'option',
    id: 'arrivalAirports',
    label: 'Arrival airport',
    group: 'location',
    icon: PlaneLanding,
    replacedByDrilldown: true,
    values: (flight) => flight.to?.id,
    describe: (_, flight) => airportOption(flight.to),
  },
  {
    kind: 'option',
    id: 'departureCountries',
    label: 'Departure country',
    plural: 'Departure countries',
    group: 'location',
    icon: Flag,
    values: (flight) => flight.from?.country,
    describe: countryOption,
  },
  {
    kind: 'option',
    id: 'arrivalCountries',
    label: 'Arrival country',
    plural: 'Arrival countries',
    group: 'location',
    icon: Flag,
    values: (flight) => flight.to?.country,
    describe: countryOption,
  },
  {
    kind: 'option',
    id: 'departureContinents',
    label: 'Departure continent',
    group: 'location',
    icon: Earth,
    values: (flight) => flight.from?.continent,
    known: continentOptions,
  },
  {
    kind: 'option',
    id: 'arrivalContinents',
    label: 'Arrival continent',
    group: 'location',
    icon: Earth,
    values: (flight) => flight.to?.continent,
    known: continentOptions,
  },
  {
    kind: 'date',
    id: 'date',
    label: 'Date',
    group: 'date',
    icon: Calendar,
  },
  {
    kind: 'option',
    id: 'year',
    label: 'Year',
    group: 'date',
    icon: Calendar,
    values: (flight) => flight.date?.getFullYear(),
    compare: byValueDescending,
  },
  {
    kind: 'option',
    id: 'month',
    label: 'Month',
    group: 'date',
    icon: CalendarDays,
    // A date saved as just a year has no month to match.
    values: (flight) =>
      flight.datePrecision === 'year' ? null : flight.date?.getMonth(),
    known: MONTHS.map((name, index) => ({
      value: String(index),
      label: name,
      shortLabel: SHORT_MONTHS[index],
    })),
  },
  {
    kind: 'option',
    id: 'dayOfMonth',
    label: 'Day of month',
    plural: 'Days of month',
    group: 'date',
    icon: CalendarCheck,
    values: (flight) =>
      flight.datePrecision === 'day' ? flight.date?.getDate() : null,
    compare: byValueNatural,
  },
  {
    kind: 'option',
    id: 'airline',
    label: 'Airline',
    group: 'airline',
    icon: Airlines,
    values: (flight) => flight.airline?.name,
    describe: (value, flight) => ({
      label: value,
      keywords: [flight.airline?.iata, flight.airline?.icao].filter(
        (code): code is string => !!code,
      ),
      icon: flight.airline?.iconPath
        ? { kind: 'logo', src: `/api/uploads/${flight.airline.iconPath}` }
        : undefined,
    }),
  },
  {
    kind: 'option',
    id: 'flightNumber',
    label: 'Flight number',
    group: 'airline',
    icon: Ticket,
    values: (flight) => flight.flightNumber,
    describe: (value, flight) => ({
      label: value,
      description: routeLabelForFlight(flight) ?? undefined,
      icon: flight.airline?.iconPath
        ? { kind: 'logo', src: `/api/uploads/${flight.airline.iconPath}` }
        : undefined,
    }),
    compare: byValueNatural,
  },
  {
    kind: 'option',
    id: 'aircraft',
    label: 'Aircraft',
    plural: 'Aircraft',
    group: 'airline',
    icon: Plane,
    values: (flight) => flight.aircraft?.name,
    describe: (value, flight) => ({
      label: value,
      keywords: flight.aircraft?.icao ? [flight.aircraft.icao] : [],
    }),
  },
  {
    kind: 'option',
    id: 'aircraftRegs',
    label: 'Tail number',
    group: 'airline',
    icon: Hash,
    values: (flight) => flight.aircraftReg,
    describe: (value, flight) => ({
      label: value,
      description: flight.aircraft?.name,
    }),
  },
  {
    kind: 'option',
    id: 'flightType',
    label: 'Domestic or international',
    plural: 'Flight types',
    group: 'flight',
    icon: Globe,
    values: (flight) =>
      flight.from?.country && flight.to?.country
        ? flight.from.country === flight.to.country
          ? 'domestic'
          : 'international'
        : null,
    known: [
      { value: 'domestic', label: 'Domestic' },
      { value: 'international', label: 'International' },
    ],
  },
  {
    kind: 'option',
    id: 'duration',
    label: 'Flight time',
    group: 'flight',
    icon: Timer,
    values: (flight) => durationBucket(flight.duration),
    known: [
      { value: 'short', label: 'Under 3h' },
      { value: 'medium', label: '3–6h' },
      { value: 'long', label: '6–12h' },
      { value: 'ultralong', label: '12h or more' },
    ],
  },
  {
    kind: 'option',
    id: 'flightReason',
    label: 'Flight reason',
    group: 'flight',
    icon: Briefcase,
    // Options come from the flights rather than a fixed list, so a user's own
    // reasons show up too. They're keyed by label, as in the statistics, so a
    // saved "Business" and the built-in "business" are one option.
    values: (flight, scope) =>
      scopedPassengers(flight, scope).map(
        (passenger) =>
          passenger.flightReason &&
          flightReasonLabel(passenger.flightReason.trim()),
      ),
  },
  {
    kind: 'option',
    id: 'seatClass',
    label: 'Seat class',
    group: 'seat',
    icon: Armchair,
    values: (flight, scope) =>
      scopedPassengers(flight, scope).map((passenger) => passenger.seatClass),
    known: SeatClasses.map((value) => ({ value, label: toTitleCase(value) })),
  },
  {
    kind: 'option',
    id: 'seatType',
    label: 'Seat type',
    group: 'seat',
    icon: PersonStanding,
    values: (flight, scope) =>
      scopedPassengers(flight, scope).map((passenger) => passenger.seat),
    known: SeatTypes.map((value) => ({
      value,
      label: SeatTypeLabels[value],
    })),
  },
  {
    kind: 'option',
    id: 'seatNumber',
    label: 'Seat number',
    group: 'seat',
    icon: LocateFixed,
    values: (flight, scope) =>
      scopedPassengers(flight, scope).map(
        (passenger) =>
          normalizeSeatNumber(passenger.seatNumber) ??
          passenger.seatNumber?.trim(),
      ),
    compare: byValueNatural,
  },
  {
    kind: 'option',
    id: 'passengers',
    label: 'Passenger',
    plural: 'Passengers',
    group: 'people',
    icon: UsersRound,
    multi: true,
    values: (flight) => flight.passengers.map(getFlightPassengerToken),
    describe: (value, flight) => {
      const passenger = flight.passengers.find(
        (candidate) => getFlightPassengerToken(candidate) === value,
      );
      const label = passenger ? (getFlightPassengerLabel(passenger) ?? '') : '';
      return {
        label,
        icon: {
          kind: 'avatar',
          username: passenger?.user?.username ?? `guest:${label}`,
        },
      };
    },
  },
] as const satisfies readonly (OptionFilterDefinition | DateFilterDefinition)[];

export type FilterDefinition = (typeof FILTER_DEFINITIONS)[number];
export type FilterId = FilterDefinition['id'];
export type OptionFilterId = Extract<
  FilterDefinition,
  { kind: 'option' }
>['id'];

export const OPTION_FILTERS = FILTER_DEFINITIONS.filter(
  (definition) => definition.kind === 'option',
) as readonly (OptionFilterDefinition & { id: OptionFilterId })[];

const DEFINITIONS_BY_ID = new Map<FilterId, FilterDefinition>(
  FILTER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export const filterDefinition = (id: FilterId) => DEFINITIONS_BY_ID.get(id)!;

export const optionFilterDefinition = (id: OptionFilterId) =>
  filterDefinition(id) as OptionFilterDefinition & { id: OptionFilterId };

/** A flight's values for a filter, as option values. */
export const flightValues = (
  definition: OptionFilterDefinition,
  flight: FlightData,
  scope: FilterScope,
): string[] => {
  const raw = definition.values(flight, scope);
  const values = Array.isArray(raw) ? raw : [raw];
  return values.flatMap((value) =>
    value === null || value === undefined || value === ''
      ? []
      : [String(value)],
  );
};

const byCount = (a: FilterOption, b: FilterOption) =>
  b.count - a.count || a.label.localeCompare(b.label);

/* The options a filter offers for these flights, each with its flight count. */
export const buildFilterOptions = (
  definition: OptionFilterDefinition,
  flights: FlightData[],
  scope: FilterScope,
): FilterOption[] => {
  const counts = new Map<string, number>();
  const firstFlight = new Map<string, FlightData>();

  for (const flight of flights) {
    for (const value of new Set(flightValues(definition, flight, scope))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      if (!firstFlight.has(value)) firstFlight.set(value, flight);
    }
  }

  if (definition.known) {
    return definition.known.flatMap((option) => {
      const count = counts.get(option.value);
      return count ? [{ ...option, count }] : [];
    });
  }

  return Array.from(counts, ([value, count]) => ({
    value,
    label: value,
    ...definition.describe?.(value, firstFlight.get(value)!),
    count,
  })).sort(definition.compare ?? byCount);
};
