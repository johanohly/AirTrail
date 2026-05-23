import { db } from '@test/db';

export type UserPreferences = {
  distanceUnit?: 'km' | 'mi' | 'nm';
  windSpeedUnit?: 'kt' | 'mph' | 'kmh' | 'ms';
  temperatureUnit?: 'c' | 'f';
  pressureUnit?: 'hpa' | 'inhg';
  timeFormat?: '12h' | '24h' | 'auto';
  dateFormat?: 'iso' | 'us' | 'eu' | 'auto';
  weekStartsOn?: 'mon' | 'sun' | 'auto';
  flightTimeDisplay?: 'airport' | 'utc' | 'system';
};

export const preferencesFactory = {
  async set(userId: string, prefs: UserPreferences): Promise<void> {
    if (Object.keys(prefs).length === 0) return;
    await db.updateTable('user').set(prefs).where('id', '=', userId).execute();
  },
};
