import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Flight = {
    id: Generated<number>;
    date: string;
    from: string;
    to: string;
    departure: number | null;
    arrival: number | null;
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
    airline: string | null;
    aircraft: string | null;
    aircraftReg: string | null;
    note: string | null;
    userId: string;
};
export type Session = {
    id: string;
    expiresAt: number;
    userId: string;
};
export type User = {
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
    Flight: Flight;
    Session: Session;
    User: User;
};
