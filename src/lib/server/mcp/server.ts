import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import {
  flightInputSchema,
  shareInputSchema,
  visitedCountryInputSchema,
} from '$lib/api/v1/schemas';
import { updatePreferencesSchema } from '$lib/zod/user';
import { flightTrackInputSchema } from '$lib/track/schema';
import type { ApiPrincipal } from '$lib/server/api/v1/principal';
import { parsePage } from '$lib/server/api/v1/query';
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
import {
  exportFlights,
  getFlightById,
  getFlightStats,
  listFlights,
} from '$lib/server/api/v1/services/flights';
import {
  createShare,
  deleteShare,
  listCustomFields,
  listShares,
  listVisitedCountries,
  removeVisitedCountry,
  setVisitedCountry,
  updatePreferences,
  updateShare,
} from '$lib/server/api/v1/services/personal';
import { getProfile } from '$lib/server/api/v1/services/profile';
import {
  getAircraft,
  getAirline,
  getAirport,
  searchAircraft,
  searchAirlines,
  searchAirports,
} from '$lib/server/api/v1/services/reference';
import { mcpTool } from './tool';

/** A positive integer `id`, shared by every by-id tool. */
const idInput = { id: z.number().int().positive() };
const destructive = { annotations: { destructiveHint: true } } as const;

/*
 * Every tool is a thin projection of the same service the REST route calls, so
 * the two surfaces cannot drift on scope enforcement or on business rules. They
 * previously re-queried the database independently and had already diverged at
 * birth: the profile tool enforced no scope at all, the share tools skipped both
 * the showTracks invariant and the slug conflict check, and custom fields came
 * back in a different order.
 */
export const createMcpServer = (principal: ApiPrincipal) => {
  const server = new McpServer({ name: 'airtrail', version: '1.0.0' });

  server.registerTool(
    'airtrail_get_profile',
    { description: 'Get the authenticated AirTrail profile' },
    mcpTool('Unable to load profile', () => getProfile(principal)),
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
    mcpTool('Unable to list flights', ({ scope, limit, cursor }) =>
      listFlights(principal, { scope }, parsePage(limit, cursor ?? null)),
    ),
  );

  server.registerTool(
    'airtrail_get_flight',
    { description: 'Get one visible AirTrail flight', inputSchema: idInput },
    mcpTool('Unable to load flight', ({ id }) => getFlightById(principal, id)),
  );

  server.registerTool(
    'airtrail_create_flight',
    {
      description: 'Create an AirTrail flight',
      inputSchema: flightInputSchema,
    },
    mcpTool('Unable to create flight', async (input) => ({
      id: await createApiFlight(principal, input),
    })),
  );

  server.registerTool(
    'airtrail_update_flight',
    {
      description: 'Replace an AirTrail flight',
      inputSchema: flightInputSchema.extend(idInput),
    },
    mcpTool('Unable to update flight', async ({ id, ...input }) => {
      await updateApiFlight(principal, id, input);
      return { id, updated: true };
    }),
  );

  server.registerTool(
    'airtrail_delete_flight',
    {
      description: 'Delete an AirTrail flight',
      inputSchema: idInput,
      ...destructive,
    },
    mcpTool('Unable to delete flight', async ({ id }) => {
      await deleteApiFlight(principal, id);
      return { id, deleted: true };
    }),
  );

  server.registerTool(
    'airtrail_export_flights',
    {
      description: 'Export visible flights as a backup document',
      inputSchema: { scope: z.enum(['mine', 'all']).default('mine') },
    },
    mcpTool('Unable to export flights', ({ scope }) =>
      exportFlights(principal, { scope }),
    ),
  );

  server.registerTool(
    'airtrail_get_flight_track',
    { description: 'Get a flight track', inputSchema: idInput },
    mcpTool('Unable to load track', ({ id }) =>
      getApiFlightTrack(principal, id),
    ),
  );

  server.registerTool(
    'airtrail_set_flight_track',
    {
      description: 'Replace a flight track',
      inputSchema: flightTrackInputSchema.extend(idInput),
    },
    mcpTool('Unable to save track', ({ id, ...track }) =>
      setApiFlightTrack(principal, id, track),
    ),
  );

  server.registerTool(
    'airtrail_delete_flight_track',
    {
      description: 'Delete a flight track',
      inputSchema: idInput,
      ...destructive,
    },
    mcpTool('Unable to delete track', async ({ id }) => {
      await deleteApiFlightTrack(principal, id);
      return { id, deleted: true };
    }),
  );

  server.registerTool(
    'airtrail_get_stats',
    {
      description: 'Get flight statistics',
      inputSchema: { scope: z.enum(['mine', 'all']).default('mine') },
    },
    mcpTool('Unable to load statistics', ({ scope }) =>
      getFlightStats(principal, { scope }),
    ),
  );

  const query = { query: z.string().min(1) };
  server.registerTool(
    'airtrail_search_airports',
    {
      description: 'Search airports by name, ICAO, or IATA',
      inputSchema: query,
    },
    mcpTool('Unable to search airports', ({ query }) =>
      searchAirports(principal, query),
    ),
  );
  server.registerTool(
    'airtrail_get_airport',
    { description: 'Get an airport by id', inputSchema: idInput },
    mcpTool('Unable to load airport', ({ id }) => getAirport(principal, id)),
  );
  server.registerTool(
    'airtrail_search_airlines',
    { description: 'Search airlines', inputSchema: query },
    mcpTool('Unable to search airlines', ({ query }) =>
      searchAirlines(principal, query),
    ),
  );
  server.registerTool(
    'airtrail_get_airline',
    { description: 'Get an airline by id', inputSchema: idInput },
    mcpTool('Unable to load airline', ({ id }) => getAirline(principal, id)),
  );
  server.registerTool(
    'airtrail_search_aircraft',
    { description: 'Search aircraft types', inputSchema: query },
    mcpTool('Unable to search aircraft', ({ query }) =>
      searchAircraft(principal, query),
    ),
  );
  server.registerTool(
    'airtrail_get_aircraft',
    { description: 'Get an aircraft type by id', inputSchema: idInput },
    mcpTool('Unable to load aircraft', ({ id }) => getAircraft(principal, id)),
  );

  server.registerTool(
    'airtrail_list_custom_fields',
    { description: 'List active custom field definitions' },
    mcpTool('Unable to load custom fields', () => listCustomFields(principal)),
  );

  server.registerTool(
    'airtrail_update_preferences',
    {
      description: 'Update profile preferences',
      inputSchema: updatePreferencesSchema,
    },
    mcpTool('Unable to update preferences', (input) =>
      updatePreferences(principal, input),
    ),
  );

  server.registerTool(
    'airtrail_list_visited_countries',
    { description: 'List personal visited countries' },
    mcpTool('Unable to load countries', () => listVisitedCountries(principal)),
  );
  server.registerTool(
    'airtrail_set_visited_country',
    {
      description: 'Create or update a visited country',
      inputSchema: visitedCountryInputSchema,
    },
    mcpTool('Unable to save country', (input) =>
      setVisitedCountry(principal, input),
    ),
  );
  server.registerTool(
    'airtrail_remove_visited_country',
    {
      description: 'Remove a visited country',
      inputSchema: { code: z.string().length(2) },
      ...destructive,
    },
    mcpTool('Unable to remove country', async ({ code }) => ({
      code: await removeVisitedCountry(principal, code),
      deleted: true,
    })),
  );

  server.registerTool(
    'airtrail_list_shares',
    { description: 'List personal public shares' },
    mcpTool('Unable to load shares', () => listShares(principal)),
  );
  server.registerTool(
    'airtrail_create_share',
    { description: 'Create a public share', inputSchema: shareInputSchema },
    mcpTool('Unable to create share', (input) => createShare(principal, input)),
  );
  server.registerTool(
    'airtrail_update_share',
    {
      description: 'Replace a public share',
      inputSchema: shareInputSchema.extend(idInput),
    },
    mcpTool('Unable to update share', ({ id, ...input }) =>
      updateShare(principal, id, input),
    ),
  );
  server.registerTool(
    'airtrail_delete_share',
    {
      description: 'Delete a public share',
      inputSchema: idInput,
      ...destructive,
    },
    mcpTool('Unable to delete share', async ({ id }) => {
      await deleteShare(principal, id);
      return { id, deleted: true };
    }),
  );

  server.registerResource(
    'airtrail-profile',
    'airtrail://profile',
    { mimeType: 'application/json' },
    // Goes through getProfile, so it costs profile.read like the tool does.
    async () => ({
      contents: [
        {
          uri: 'airtrail://profile',
          mimeType: 'application/json',
          text: JSON.stringify(getProfile(principal)),
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
