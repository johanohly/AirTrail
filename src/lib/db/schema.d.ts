import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type app_config = {
    id: Generated<number>;
    config: Generated<unknown>;
};
export type flight = {
    id: Generated<number>;
    date: string;
    from: string;
    to: string;
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
    /**
     * ICAO airline code
     */
    airline: string | null;
    /**
     * ICAO type code
     */
    aircraft: string | null;
    aircraftReg: string | null;
    note: string | null;
};
export type seat = {
    id: Generated<number>;
    flightId: number;
    userId: string | null;
    guestName: string | null;
    /**
     * @kyselyType('window' | 'aisle' | 'middle' | 'other')
     */
    seat: 'window' | 'aisle' | 'middle' | 'other' | null;
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
    appConfig: app_config;
    flight: flight;
    seat: seat;
    session: session;
    user: user;
    visitedCountry: visited_country;
};
