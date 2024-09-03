import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type flight = {
    id: Generated<number>;
    date: string;
    from: string;
    to: string;
    departure: Timestamp | null;
    arrival: Timestamp | null;
    duration: number | null;
    flightNumber: string | null;
    /**
     * @kyselyType('window' | 'aisle' | 'middle' | 'other')
     */
    seat: 'window' | 'aisle' | 'middle' | 'other' | null;
    seatNumber: string | null;
    /**
     * @kyselyType('economy' | 'economy+' | 'business' | 'first' | 'private')
     */
    seatClass: 'economy' | 'economy+' | 'business' | 'first' | 'private' | null;
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
    userId: string;
};
export type session = {
    id: string;
    expiresAt: Timestamp;
    userId: string;
};
export type user = {
    id: string;
    username: string;
    password: string;
    displayName: string;
    /**
     * @kyselyType('metric' | 'imperial')
     */
    unit: 'metric' | 'imperial';
    /**
     * @kyselyType('user' | 'admin')
     */
    role: 'user' | 'admin';
};
export type DB = {
    flight: flight;
    session: session;
    user: user;
};
