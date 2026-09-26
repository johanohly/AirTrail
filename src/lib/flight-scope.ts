import { z } from 'zod';

export const flightScopeSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('mine') }),
  z.object({ scope: z.literal('user'), userId: z.string().min(1) }),
  z.object({ scope: z.literal('all') }),
]);

export type FlightScope = z.infer<typeof flightScopeSchema>;
export type ResolvedFlightScope = Exclude<FlightScope, { scope: 'mine' }>;

export const DEFAULT_FLIGHT_SCOPE = {
  scope: 'mine',
} satisfies FlightScope;

export const resolveFlightScope = (
  scope: FlightScope,
  actorUserId: string,
): ResolvedFlightScope =>
  scope.scope === 'mine' ? { scope: 'user', userId: actorUserId } : scope;

export type FlightScopeParseResult =
  | { success: true; data: FlightScope }
  | { success: false; reason: 'invalid_scope' | 'missing_user' };

export const parseFlightScopeSearchParams = (
  searchParams: URLSearchParams,
): FlightScopeParseResult => {
  const scope = searchParams.get('scope') ?? 'mine';
  if (scope === 'mine' || scope === 'all') {
    return { success: true, data: { scope } };
  }
  if (scope !== 'user') {
    return { success: false, reason: 'invalid_scope' };
  }

  const userId = searchParams.get('userId');
  return userId
    ? { success: true, data: { scope, userId } }
    : { success: false, reason: 'missing_user' };
};
