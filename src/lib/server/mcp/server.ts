import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import type { ApiPrincipal } from '$lib/server/api/v1/principal';
import { listFlightsPage, parsePage } from '$lib/server/api/v1/flight-read';
import { toFlightDto } from '$lib/api/v1/dto';
import { parseFlightScopeSearchParams } from '$lib/flight-scope';
import {
  canListFlights,
  canAccessFlight,
} from '$lib/server/authorization/flight';
import { getFlight } from '$lib/server/utils/flight';
import { principalHasScope } from '$lib/server/api/v1/principal';
import {
  flightInputSchema,
  shareInputSchema,
  visitedCountryInputSchema,
} from '$lib/api/v1/schemas';
import {
  createApiFlight,
  deleteApiFlight,
  updateApiFlight,
} from '$lib/server/api/v1/flight-write';
import {
  deleteApiFlightTrack,
  getApiFlightTrack,
  setApiFlightTrack,
} from '$lib/server/api/v1/track';
import { flightTrackInputSchema } from '$lib/track/schema';
import { findAirports } from '$lib/server/utils/airport';
import { findAirline } from '$lib/server/utils/airline';
import { findAircraft } from '$lib/server/utils/aircraft';
import { toAircraftDto, toAirlineDto, toAirportDto } from '$lib/api/v1/dto';
import { db } from '$lib/db';
import {
  effectiveApiPermissions,
  requireApiScope,
} from '$lib/server/api/v1/access';
import { listFlightsInScope } from '$lib/server/utils/flight';
import { computeCompletedFlightStatsSummary } from '$lib/stats/summary';
import { updatePreferencesSchema } from '$lib/zod/user';

const toolResult = (value: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: value,
});
const toolError = (message: string) => ({
  isError: true,
  content: [{ type: 'text' as const, text: message }],
});

export const createMcpServer = (principal: ApiPrincipal) => {
  const server = new McpServer({ name: 'airtrail', version: '1.0.0' });
  server.registerTool(
    'airtrail_get_profile',
    { description: 'Get the authenticated AirTrail profile' },
    async () =>
      toolResult({
        id: principal.user.id,
        username: principal.user.username,
        displayName: principal.user.displayName,
        role: principal.authorization.roleName,
        permissions: effectiveApiPermissions(principal),
      }),
  );
  server.registerTool(
    'airtrail_list_flights',
    {
      description: 'List visible AirTrail flights',
      inputSchema: {
        scope: z.enum(['mine', 'all']).default('mine'),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().nullable().optional(),
      },
    },
    async ({ scope, limit, cursor }) => {
      try {
        const requestedScope = { scope } as const;
        if (!canListFlights(principal.authorization, requestedScope))
          return toolError('You cannot read this flight scope');
        const required =
          scope === 'mine' ? 'flight.read.own' : 'flight.read.any';
        if (!principalHasScope(principal, required))
          return toolError(`Credential requires ${required}`);
        const page = parsePage(String(limit), cursor ?? null);
        if (!page) return toolError('Invalid pagination');
        const result = await listFlightsPage(
          scope === 'mine'
            ? { scope: 'user', userId: principal.user.id }
            : { scope: 'all' },
          page,
        );
        return toolResult({
          data:
            result?.flights.map((flight) =>
              toFlightDto(flight, result.tracks.get(flight.id) ?? null),
            ) ?? [],
          page: { nextCursor: result?.nextCursor ?? null },
        });
      } catch {
        return toolError('Unable to list flights');
      }
    },
  );
  server.registerTool(
    'airtrail_get_flight',
    {
      description: 'Get one visible AirTrail flight',
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      try {
        const flight = await getFlight(id);
        if (
          !flight ||
          !(await canAccessFlight(principal.authorization, 'read', id))
        )
          return toolError('Flight not found');
        const participant = flight.passengers.some(
          (p) => p.userId === principal.user.id,
        );
        if (
          !principalHasScope(
            principal,
            participant ? 'flight.read.own' : 'flight.read.any',
          )
        )
          return toolError('Credential cannot read this flight');
        return toolResult({ data: toFlightDto(flight) });
      } catch {
        return toolError('Unable to load flight');
      }
    },
  );
  server.registerTool(
    'airtrail_create_flight',
    {
      description: 'Create an AirTrail flight',
      inputSchema: flightInputSchema,
    },
    async (input) => {
      try {
        const id = await createApiFlight(principal, input);
        return toolResult({ id });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to create flight',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_update_flight',
    {
      description: 'Replace an AirTrail flight',
      inputSchema: flightInputSchema.extend({
        id: z.number().int().positive(),
      }),
    },
    async ({ id, ...input }) => {
      try {
        await updateApiFlight(principal, id, input);
        return toolResult({ id, updated: true });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to update flight',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_delete_flight',
    {
      description: 'Delete an AirTrail flight',
      inputSchema: { id: z.number().int().positive() },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      try {
        await deleteApiFlight(principal, id);
        return toolResult({ id, deleted: true });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to delete flight',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_get_flight_track',
    {
      description: 'Get a flight track',
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      try {
        return toolResult({ data: await getApiFlightTrack(principal, id) });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to load track',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_set_flight_track',
    {
      description: 'Replace a flight track',
      inputSchema: flightTrackInputSchema.extend({
        id: z.number().int().positive(),
      }),
    },
    async ({ id, ...track }) => {
      try {
        return toolResult({
          data: await setApiFlightTrack(principal, id, track),
        });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to save track',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_delete_flight_track',
    {
      description: 'Delete a flight track',
      inputSchema: { id: z.number().int().positive() },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      try {
        await deleteApiFlightTrack(principal, id);
        return toolResult({ id, deleted: true });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to delete track',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_get_stats',
    { description: 'Get personal flight statistics' },
    async () => {
      try {
        requireApiScope(principal, 'stats.read');
        return toolResult({
          data: computeCompletedFlightStatsSummary(
            await listFlightsInScope({
              scope: 'user',
              userId: principal.user.id,
            }),
          ),
        });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to load statistics',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_search_airports',
    {
      description: 'Search airports by name, ICAO, or IATA',
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => {
      try {
        requireApiScope(principal, 'reference_data.read');
        return toolResult({
          data: (await findAirports(query)).map(toAirportDto),
        });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to search airports',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_get_airport',
    {
      description: 'Get an airport by id',
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      try {
        requireApiScope(principal, 'reference_data.read');
        const row = await db
          .selectFrom('airport')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();
        return row
          ? toolResult({ data: toAirportDto(row) })
          : toolError('Airport not found');
      } catch {
        return toolError('Unable to load airport');
      }
    },
  );
  server.registerTool(
    'airtrail_search_airlines',
    {
      description: 'Search airlines',
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => {
      try {
        requireApiScope(principal, 'reference_data.read');
        return toolResult({
          data: ((await findAirline(query)) ?? []).map(toAirlineDto),
        });
      } catch {
        return toolError('Unable to search airlines');
      }
    },
  );
  server.registerTool(
    'airtrail_get_airline',
    {
      description: 'Get an airline by id',
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      try {
        requireApiScope(principal, 'reference_data.read');
        const row = await db
          .selectFrom('airline')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();
        return row
          ? toolResult({ data: toAirlineDto(row) })
          : toolError('Airline not found');
      } catch {
        return toolError('Unable to load airline');
      }
    },
  );
  server.registerTool(
    'airtrail_search_aircraft',
    {
      description: 'Search aircraft types',
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => {
      try {
        requireApiScope(principal, 'reference_data.read');
        return toolResult({
          data: ((await findAircraft(query)) ?? []).map(toAircraftDto),
        });
      } catch {
        return toolError('Unable to search aircraft');
      }
    },
  );
  server.registerTool(
    'airtrail_get_aircraft',
    {
      description: 'Get an aircraft type by id',
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      try {
        requireApiScope(principal, 'reference_data.read');
        const row = await db
          .selectFrom('aircraft')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();
        return row
          ? toolResult({ data: toAircraftDto(row) })
          : toolError('Aircraft not found');
      } catch {
        return toolError('Unable to load aircraft');
      }
    },
  );
  server.registerTool(
    'airtrail_list_custom_fields',
    { description: 'List active custom field definitions' },
    async () => {
      try {
        requireApiScope(principal, 'profile.read');
        return toolResult({
          data: await db
            .selectFrom('customFieldDefinition')
            .selectAll()
            .where('active', '=', true)
            .orderBy('order')
            .execute(),
        });
      } catch {
        return toolError('Unable to load custom fields');
      }
    },
  );
  server.registerTool(
    'airtrail_update_preferences',
    {
      description: 'Update profile preferences',
      inputSchema: updatePreferencesSchema,
    },
    async (input) => {
      try {
        requireApiScope(principal, 'preferences.write');
        await db
          .updateTable('user')
          .set(input)
          .where('id', '=', principal.user.id)
          .execute();
        return toolResult({ updated: true });
      } catch (error) {
        return toolError(
          error instanceof Error
            ? error.message
            : 'Unable to update preferences',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_list_visited_countries',
    { description: 'List personal visited countries' },
    async () => {
      try {
        requireApiScope(principal, 'visited_countries.read');
        return toolResult({
          data: await db
            .selectFrom('visitedCountry')
            .selectAll()
            .where('userId', '=', principal.user.id)
            .execute(),
        });
      } catch {
        return toolError('Unable to load countries');
      }
    },
  );
  server.registerTool(
    'airtrail_set_visited_country',
    {
      description: 'Create or update a visited country',
      inputSchema: visitedCountryInputSchema,
    },
    async (input) => {
      try {
        requireApiScope(principal, 'visited_countries.write');
        const row = await db
          .insertInto('visitedCountry')
          .values({ ...input, userId: principal.user.id })
          .onConflict((oc) =>
            oc
              .columns(['userId', 'code'])
              .doUpdateSet({ status: input.status, note: input.note }),
          )
          .returningAll()
          .executeTakeFirstOrThrow();
        return toolResult({ data: row });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to save country',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_remove_visited_country',
    {
      description: 'Remove a visited country',
      inputSchema: { code: z.string().length(2) },
      annotations: { destructiveHint: true },
    },
    async ({ code }) => {
      try {
        requireApiScope(principal, 'visited_countries.write');
        await db
          .deleteFrom('visitedCountry')
          .where('userId', '=', principal.user.id)
          .where('code', '=', code.toUpperCase())
          .execute();
        return toolResult({ code: code.toUpperCase(), deleted: true });
      } catch {
        return toolError('Unable to remove country');
      }
    },
  );
  server.registerTool(
    'airtrail_list_shares',
    { description: 'List personal public shares' },
    async () => {
      try {
        requireApiScope(principal, 'shares.read');
        return toolResult({
          data: await db
            .selectFrom('publicShare')
            .selectAll()
            .where('userId', '=', principal.user.id)
            .execute(),
        });
      } catch {
        return toolError('Unable to load shares');
      }
    },
  );
  server.registerTool(
    'airtrail_create_share',
    { description: 'Create a public share', inputSchema: shareInputSchema },
    async (input) => {
      try {
        requireApiScope(principal, 'shares.write');
        const row = await db
          .insertInto('publicShare')
          .values({
            ...input,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            userId: principal.user.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        return toolResult({ data: row });
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to create share',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_update_share',
    {
      description: 'Replace a public share',
      inputSchema: shareInputSchema.extend({ id: z.number().int().positive() }),
    },
    async ({ id, ...input }) => {
      try {
        requireApiScope(principal, 'shares.write');
        const row = await db
          .updateTable('publicShare')
          .set({
            ...input,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          })
          .where('id', '=', id)
          .where('userId', '=', principal.user.id)
          .returningAll()
          .executeTakeFirst();
        return row ? toolResult({ data: row }) : toolError('Share not found');
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : 'Unable to update share',
        );
      }
    },
  );
  server.registerTool(
    'airtrail_delete_share',
    {
      description: 'Delete a public share',
      inputSchema: { id: z.number().int().positive() },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      try {
        requireApiScope(principal, 'shares.write');
        await db
          .deleteFrom('publicShare')
          .where('id', '=', id)
          .where('userId', '=', principal.user.id)
          .execute();
        return toolResult({ id, deleted: true });
      } catch {
        return toolError('Unable to delete share');
      }
    },
  );
  server.registerResource(
    'airtrail-profile',
    'airtrail://profile',
    { mimeType: 'application/json' },
    async () => ({
      contents: [
        {
          uri: 'airtrail://profile',
          mimeType: 'application/json',
          text: JSON.stringify({
            id: principal.user.id,
            username: principal.user.username,
            displayName: principal.user.displayName,
          }),
        },
      ],
    }),
  );
  return server;
};

export const handleMcpRequest = async (
  request: Request,
  principal: ApiPrincipal,
) => {
  const server = createMcpServer(principal);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, {
      authInfo: {
        token: 'redacted',
        clientId:
          principal.credential.kind === 'oauth'
            ? principal.credential.clientId
            : `api-key:${principal.credential.keyId}`,
        scopes: [...principal.credential.scopes],
        resource:
          principal.credential.kind === 'oauth'
            ? new URL(principal.credential.resource)
            : undefined,
      },
    });
  } finally {
    await transport.close();
    await server.close();
  }
};
