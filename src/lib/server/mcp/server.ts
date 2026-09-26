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
import { requireOperation } from '$lib/server/api/v1/access';
import type { ApiPrincipal } from '$lib/server/api/v1/principal';
import { parseFlightScope, parsePage } from '$lib/server/api/v1/query';
import {
  createFlight,
  deleteFlight,
  exportFlights,
  getFlight,
  getFlightStats,
  listFlights,
  updateFlight,
} from '$lib/server/api/v1/services/flights';
import {
  deleteFlightTrack,
  getFlightTrack,
  setFlightTrack,
} from '$lib/server/api/v1/services/tracks';
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
import { operationTools } from './tool';

const idInput = { id: z.number().int().positive() };
const queryInput = { query: z.string().min(1) };
const noInput = {};
/** The same `scope`/`userId` pair the REST query string takes. */
const flightScopeInput = {
  scope: z.enum(['mine', 'user', 'all']).default('mine'),
  userId: z.string().min(1).optional(),
};
const destructive = { annotations: { destructiveHint: true } } as const;

const toFlightScope = ({ scope, userId }: { scope: string; userId?: string }) =>
  parseFlightScope(
    new URLSearchParams({ scope, ...(userId ? { userId } : {}) }),
  );

export const createMcpServer = (principal: ApiPrincipal) => {
  const server = new McpServer({ name: 'airtrail', version: '1.0.0' });
  const tool = operationTools(server, principal);

  tool(
    'api-v1-get-me',
    {
      description: 'Get the authenticated AirTrail profile',
      inputSchema: noInput,
    },
    'Unable to load profile',
    () => getProfile(principal),
  );

  tool(
    'api-v1-list-flights',
    {
      description: 'List visible AirTrail flights',
      inputSchema: {
        ...flightScopeInput,
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().nullable().optional(),
      },
    },
    'Unable to list flights',
    ({ limit, cursor, ...scope }) =>
      listFlights(
        principal,
        toFlightScope(scope),
        parsePage(limit, cursor ?? null),
      ),
  );

  tool(
    'api-v1-get-flight',
    { description: 'Get one visible AirTrail flight', inputSchema: idInput },
    'Unable to load flight',
    ({ id }) => getFlight(principal, id),
  );

  tool(
    'api-v1-create-flight',
    {
      description: 'Create an AirTrail flight',
      inputSchema: flightInputSchema,
    },
    'Unable to create flight',
    async (input) => ({ id: await createFlight(principal, input) }),
  );

  tool(
    'api-v1-update-flight',
    {
      description: 'Replace an AirTrail flight',
      inputSchema: flightInputSchema.extend(idInput),
    },
    'Unable to update flight',
    ({ id, ...input }) => updateFlight(principal, id, input),
  );

  tool(
    'api-v1-delete-flight',
    {
      description: 'Delete an AirTrail flight',
      inputSchema: idInput,
      ...destructive,
    },
    'Unable to delete flight',
    async ({ id }) => {
      await deleteFlight(principal, id);
      return { id, deleted: true };
    },
  );

  tool(
    'api-v1-export-flights',
    {
      description: 'Export visible flights as a backup document',
      inputSchema: flightScopeInput,
    },
    'Unable to export flights',
    (scope) => exportFlights(principal, toFlightScope(scope)),
  );

  tool(
    'api-v1-get-flight-track',
    { description: 'Get a flight track', inputSchema: idInput },
    'Unable to load track',
    ({ id }) => getFlightTrack(principal, id),
  );

  tool(
    'api-v1-set-flight-track',
    {
      description: 'Replace a flight track',
      inputSchema: flightTrackInputSchema.extend(idInput),
    },
    'Unable to save track',
    ({ id, ...track }) => setFlightTrack(principal, id, track),
  );

  tool(
    'api-v1-delete-flight-track',
    {
      description: 'Delete a flight track',
      inputSchema: idInput,
      ...destructive,
    },
    'Unable to delete track',
    async ({ id }) => {
      await deleteFlightTrack(principal, id);
      return { id, deleted: true };
    },
  );

  tool(
    'api-v1-get-stats',
    { description: 'Get flight statistics', inputSchema: flightScopeInput },
    'Unable to load statistics',
    (scope) => getFlightStats(principal, toFlightScope(scope)),
  );

  tool(
    'api-v1-search-airports',
    {
      description: 'Search airports by name, ICAO, or IATA',
      inputSchema: queryInput,
    },
    'Unable to search airports',
    ({ query }) => searchAirports(query),
  );
  tool(
    'api-v1-get-airport',
    { description: 'Get an airport by id', inputSchema: idInput },
    'Unable to load airport',
    ({ id }) => getAirport(id),
  );
  tool(
    'api-v1-search-airlines',
    { description: 'Search airlines', inputSchema: queryInput },
    'Unable to search airlines',
    ({ query }) => searchAirlines(query),
  );
  tool(
    'api-v1-get-airline',
    { description: 'Get an airline by id', inputSchema: idInput },
    'Unable to load airline',
    ({ id }) => getAirline(id),
  );
  tool(
    'api-v1-search-aircraft',
    { description: 'Search aircraft types', inputSchema: queryInput },
    'Unable to search aircraft',
    ({ query }) => searchAircraft(query),
  );
  tool(
    'api-v1-get-aircraft',
    { description: 'Get an aircraft type by id', inputSchema: idInput },
    'Unable to load aircraft',
    ({ id }) => getAircraft(id),
  );

  tool(
    'api-v1-list-custom-fields',
    {
      description: 'List active custom field definitions',
      inputSchema: noInput,
    },
    'Unable to load custom fields',
    () => listCustomFields(),
  );

  tool(
    'api-v1-update-preferences',
    {
      description: 'Update profile preferences',
      inputSchema: updatePreferencesSchema,
    },
    'Unable to update preferences',
    (input) => updatePreferences(principal, input),
  );

  tool(
    'api-v1-list-visited-countries',
    { description: 'List personal visited countries', inputSchema: noInput },
    'Unable to load countries',
    () => listVisitedCountries(principal),
  );
  tool(
    'api-v1-set-visited-country',
    {
      description: 'Create or update a visited country',
      inputSchema: visitedCountryInputSchema,
    },
    'Unable to save country',
    (input) => setVisitedCountry(principal, input),
  );
  tool(
    'api-v1-remove-visited-country',
    {
      description: 'Remove a visited country',
      inputSchema: { code: z.string().length(2) },
      ...destructive,
    },
    'Unable to remove country',
    async ({ code }) => ({
      code: await removeVisitedCountry(principal, code),
      deleted: true,
    }),
  );

  tool(
    'api-v1-list-shares',
    { description: 'List personal public shares', inputSchema: noInput },
    'Unable to load shares',
    () => listShares(principal),
  );
  tool(
    'api-v1-create-share',
    { description: 'Create a public share', inputSchema: shareInputSchema },
    'Unable to create share',
    (input) => createShare(principal, input),
  );
  tool(
    'api-v1-update-share',
    {
      description: 'Replace a public share',
      inputSchema: shareInputSchema.extend(idInput),
    },
    'Unable to update share',
    ({ id, ...input }) => updateShare(principal, id, input),
  );
  tool(
    'api-v1-delete-share',
    {
      description: 'Delete a public share',
      inputSchema: idInput,
      ...destructive,
    },
    'Unable to delete share',
    async ({ id }) => {
      await deleteShare(principal, id);
      return { id, deleted: true };
    },
  );

  server.registerResource(
    'airtrail-profile',
    'airtrail://profile',
    { mimeType: 'application/json' },
    async () => {
      requireOperation(principal, 'api-v1-get-me');
      return {
        contents: [
          {
            uri: 'airtrail://profile',
            mimeType: 'application/json',
            text: JSON.stringify(getProfile(principal)),
          },
        ],
      };
    },
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
