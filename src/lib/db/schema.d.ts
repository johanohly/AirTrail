import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type aircraft = {
    id: Generated<number>;
    /**
     * ICAO aircraft type code
     */
    name: string;
    icao: string | null;
};
export type airline = {
    id: Generated<number>;
    name: string;
    icao: string | null;
    iata: string | null;
    iconPath: string | null;
};
export type airport = {
    id: Generated<number>;
    icao: string;
    iata: string | null;
    lat: number;
    lon: number;
    tz: string;
    name: string;
    municipality: string | null;
    /**
     * @kyselyType('large_airport' | 'medium_airport' | 'small_airport' | 'heliport' | 'seaplane_base' | 'balloonport' | 'closed')
     */
    type: 'large_airport' | 'medium_airport' | 'small_airport' | 'heliport' | 'seaplane_base' | 'balloonport' | 'closed';
    /**
     * @kyselyType('EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC' | 'AN')
     */
    continent: 'EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC' | 'AN';
    country: string;
    custom: Generated<boolean>;
};
export type api_key = {
    id: Generated<number>;
    name: string;
    userId: string;
    key: string;
    createdAt: Generated<Timestamp>;
    lastUsed: Timestamp | null;
};
export type app_config = {
    id: Generated<number>;
    config: Generated<unknown>;
};
export type flight = {
    id: Generated<number>;
    date: string;
    /**
     * YYYY-MM-DDTHH:mm:ss.sssZ (ISO-8601)
     */
    departure: string | null;
    /**
     * YYYY-MM-DDTHH:mm:ss.sssZ (ISO-8601)
     */
    arrival: string | null;
    duration: number | null;
    flightNumber: string | null;
    /**
     * @kyselyType('leisure' | 'business' | 'crew' | 'other')
     */
    flightReason: 'leisure' | 'business' | 'crew' | 'other' | null;
    aircraftReg: string | null;
    note: string | null;
    fromId: number | null;
    toId: number | null;
    aircraftId: number | null;
    airlineId: number | null;
};
export type public_share = {
    id: Generated<number>;
    userId: string;
    slug: string;
    expiresAt: Timestamp | null;
    createdAt: Generated<Timestamp>;
    showMap: Generated<boolean>;
    showStats: Generated<boolean>;
    showFlightList: Generated<boolean>;
    dateFrom: string | null;
    dateTo: string | null;
    showFlightNumbers: Generated<boolean>;
    showAirlines: Generated<boolean>;
    showAircraft: Generated<boolean>;
    showTimes: Generated<boolean>;
    showDates: Generated<boolean>;
    showSeat: Generated<boolean>;
};
export type seat = {
    id: Generated<number>;
    flightId: number;
    userId: string | null;
    guestName: string | null;
    /**
     * @kyselyType('window' | 'aisle' | 'middle' | 'pilot' | 'copilot' | 'jumpseat' | 'other')
     */
    seat: 'window' | 'aisle' | 'middle' | 'pilot' | 'copilot' | 'jumpseat' | 'other' | null;
    /**
     * Seat number (e.g. 12A)
     */
    seatNumber: string | null;
    /**
     * @kyselyType('economy' | 'economy+' | 'business' | 'first' | 'private')
     */
    seatClass: 'economy' | 'economy+' | 'business' | 'first' | 'private' | null;
};
export type session = {
    id: string;
    expiresAt: Timestamp;
    userId: string;
};
export type user = {
    id: string;
    username: string;
    displayName: string;
    /**
     * @kyselyType('metric' | 'imperial')
     */
    unit: 'metric' | 'imperial';
    password: string | null;
    /**
     * @kyselyType('user' | 'admin' | 'owner')
     */
    role: 'user' | 'admin' | 'owner';
    oauthId: string | null;
};
export type visited_country = {
    id: Generated<number>;
    /**
     * ISO 3166-1 numeric code
     */
    code: number;
    /**
     * @kyselyType('lived' | 'visited' | 'layover' | 'wishlist')
     */
    status: 'lived' | 'visited' | 'layover' | 'wishlist';
    note: string | null;
    userId: string;
};
export type DB = {
    aircraft: aircraft;
    airline: airline;
    airport: airport;
    apiKey: api_key;
    appConfig: app_config;
    flight: flight;
    publicShare: public_share;
    seat: seat;
    session: session;
    user: user;
    visitedCountry: visited_country;
};
