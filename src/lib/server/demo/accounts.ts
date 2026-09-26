/*
 * The people in the demo world. They share one instance:
 *
 * - `maya`: a frequent flyer with tracks, shares, visited countries, API keys
 *   and a connected app. Visitors and most screenshots use her.
 * - `jonas`, `ella`: her partner and daughter, who fly along on some trips.
 * - `noah`: an administrator, for the users and roles screens.
 * - `sam`: a brand-new account with no flights, for empty states.
 *
 * This file is imported by the screenshot runner as well, so it must not
 * depend on anything from the app.
 */

export const DEMO_PASSWORD = 'airtrail-demo';

export const ACCOUNTS = {
  maya: {
    username: 'maya',
    displayName: 'Maya Lindqvist',
    description: 'Frequent flyer with years of history',
  },
  jonas: {
    username: 'jonas',
    displayName: 'Jonas Berg',
    description: 'Flies along on family trips',
  },
  ella: {
    username: 'ella',
    displayName: 'Ella Berg',
    description: 'Flies along on family trips',
  },
  noah: {
    username: 'noah',
    displayName: 'Noah Sørensen',
    description: 'Administrator of the instance',
  },
  sam: {
    username: 'sam',
    displayName: 'Sam Carter',
    description: 'Just signed up, no flights yet',
  },
} as const;

export type DemoAccount = keyof typeof ACCOUNTS;

export const isDemoAccount = (value: string): value is DemoAccount =>
  Object.hasOwn(ACCOUNTS, value);

/** The accounts offered in the demo's account switcher, in order. */
export const SWITCHABLE_ACCOUNTS: DemoAccount[] = [
  'maya',
  'jonas',
  'noah',
  'sam',
];
