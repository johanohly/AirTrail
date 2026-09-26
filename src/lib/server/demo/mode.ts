import { env } from '$env/dynamic/private';
import type { Permission } from '$lib/authorization/permissions';

/*
 * `DEMO_MODE=true` turns an instance into a public demo: it seeds the demo
 * world on first start, lets visitors in with one click, and keeps them away
 * from anything that reaches beyond the instance. `DEMO_MODE=screenshots` only
 * seeds, with dates pinned, so the documentation screenshots stay
 * reproducible and show the app as a normal install.
 */
export type DemoMode = 'off' | 'public' | 'screenshots';

export const demoMode = (): DemoMode => {
  const value = env.DEMO_MODE?.trim().toLowerCase();
  if (value === 'true' || value === '1') return 'public';
  if (value === 'screenshots') return 'screenshots';
  return 'off';
};

export const isPublicDemo = () => demoMode() === 'public';

/**
 * Taken from every account in a public demo, whatever its role grants: the SQL
 * console reaches the database server, and integrations and sign-in settings
 * make requests to services outside the instance.
 */
export const DEMO_DENIED_PERMISSIONS: readonly Permission[] = [
  'tools.sql.execute',
  'instance.integrations.manage',
  'instance.oauth.manage',
];

/** When the hosting orchestrator will stop this instance, if it said so. */
export const demoSessionEndsAt = () => {
  const value = env.DEMO_SESSION_ENDS_AT?.trim();
  if (!value) return null;
  const date = new Date(/^\d+$/.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date;
};
