import type { ColumnType } from 'kysely';
export type Generated<T> =
	T extends ColumnType<infer S, infer I, infer U>
		? ColumnType<S, I | undefined, U>
		: ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Session = {
	id: string;
	expires_at: number;
	user_id: string;
};
export type User = {
	id: string;
	twitch_id: string;
	username: string;
};
export type DB = {
	Session: Session;
	User: User;
};
