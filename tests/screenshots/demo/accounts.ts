/*
 * Demo worlds. One database holds all of them, each reachable by logging in as
 * its account:
 *
 * - `maya`: the owner, a frequent flyer with tracks, shares, visited countries,
 *   API keys and a connected app. Most screenshots use her.
 * - `jonas`, `ella`, `noah`: her household, for the users and roles screens.
 * - `sam`: a brand-new account with no flights, for empty states.
 */

export const DEMO_PASSWORD = 'airtrail-demo';

export const ACCOUNTS = {
  maya: { username: 'maya', displayName: 'Maya Lindqvist' },
  jonas: { username: 'jonas', displayName: 'Jonas Berg' },
  ella: { username: 'ella', displayName: 'Ella Berg' },
  noah: { username: 'noah', displayName: 'Noah Sørensen' },
  sam: { username: 'sam', displayName: 'Sam Carter' },
} as const;

export type DemoAccount = keyof typeof ACCOUNTS;
