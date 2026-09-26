import type { ApiScope } from './scopes';

export type ApiOperation = {
  /** Every call needs all of these; checked before the operation runs. */
  requires: readonly ApiScope[];
  /** Needed only for some targets or payloads; the service checks these. */
  conditional?: readonly ApiScope[];
  /** The MCP tool that exposes the same operation, if any. */
  mcpTool?: string;
};

const flightWrite = [
  'flight.passengers.manage.own',
  'flight.passengers.manage.any',
  'tracks.write',
] as const satisfies readonly ApiScope[];

/*
 * The scope contract of every authenticated operation, keyed by its OpenAPI
 * operationId. REST routes and MCP tools enforce `requires` from here, and the
 * contract tests hold the OpenAPI document and the MCP docs to it.
 */
export const API_OPERATIONS = {
  'api-v1-get-me': {
    requires: ['profile.read'],
    mcpTool: 'airtrail_get_profile',
  },
  'api-v1-list-flights': {
    requires: ['flight.read.own'],
    conditional: ['flight.read.any'],
    mcpTool: 'airtrail_list_flights',
  },
  'api-v1-create-flight': {
    requires: ['flight.create.own'],
    conditional: ['flight.create.any', ...flightWrite],
    mcpTool: 'airtrail_create_flight',
  },
  'api-v1-get-flight': {
    requires: ['flight.read.own'],
    conditional: ['flight.read.any'],
    mcpTool: 'airtrail_get_flight',
  },
  'api-v1-update-flight': {
    requires: ['flight.update.own'],
    conditional: ['flight.update.any', ...flightWrite],
    mcpTool: 'airtrail_update_flight',
  },
  'api-v1-delete-flight': {
    requires: ['flight.delete.own'],
    conditional: ['flight.delete.any'],
    mcpTool: 'airtrail_delete_flight',
  },
  'api-v1-get-flight-track': {
    requires: ['tracks.read', 'flight.read.own'],
    conditional: ['flight.read.any'],
    mcpTool: 'airtrail_get_flight_track',
  },
  'api-v1-set-flight-track': {
    requires: ['tracks.write', 'flight.update.own'],
    conditional: ['flight.update.any'],
    mcpTool: 'airtrail_set_flight_track',
  },
  'api-v1-delete-flight-track': {
    requires: ['tracks.write', 'flight.update.own'],
    conditional: ['flight.update.any'],
    mcpTool: 'airtrail_delete_flight_track',
  },
  'api-v1-export-flights': {
    requires: ['flight.export.own'],
    conditional: ['flight.export.any'],
    mcpTool: 'airtrail_export_flights',
  },
  'api-v1-get-stats': {
    requires: ['stats.read', 'flight.read.own'],
    conditional: ['flight.read.any'],
    mcpTool: 'airtrail_get_stats',
  },
  'api-v1-search-airports': {
    requires: ['reference_data.read'],
    mcpTool: 'airtrail_search_airports',
  },
  'api-v1-get-airport': {
    requires: ['reference_data.read'],
    mcpTool: 'airtrail_get_airport',
  },
  'api-v1-search-airlines': {
    requires: ['reference_data.read'],
    mcpTool: 'airtrail_search_airlines',
  },
  'api-v1-get-airline': {
    requires: ['reference_data.read'],
    mcpTool: 'airtrail_get_airline',
  },
  'api-v1-search-aircraft': {
    requires: ['reference_data.read'],
    mcpTool: 'airtrail_search_aircraft',
  },
  'api-v1-get-aircraft': {
    requires: ['reference_data.read'],
    mcpTool: 'airtrail_get_aircraft',
  },
  'api-v1-list-custom-fields': {
    requires: ['custom_fields.read'],
    mcpTool: 'airtrail_list_custom_fields',
  },
  'api-v1-update-preferences': {
    requires: ['preferences.write'],
    mcpTool: 'airtrail_update_preferences',
  },
  'api-v1-list-visited-countries': {
    requires: ['visited_countries.read'],
    mcpTool: 'airtrail_list_visited_countries',
  },
  'api-v1-set-visited-country': {
    requires: ['visited_countries.write'],
    mcpTool: 'airtrail_set_visited_country',
  },
  'api-v1-remove-visited-country': {
    requires: ['visited_countries.write'],
    mcpTool: 'airtrail_remove_visited_country',
  },
  'api-v1-list-shares': {
    requires: ['shares.read'],
    mcpTool: 'airtrail_list_shares',
  },
  'api-v1-create-share': {
    requires: ['shares.write'],
    mcpTool: 'airtrail_create_share',
  },
  'api-v1-update-share': {
    requires: ['shares.write'],
    mcpTool: 'airtrail_update_share',
  },
  'api-v1-delete-share': {
    requires: ['shares.write'],
    mcpTool: 'airtrail_delete_share',
  },
  'api-v1-list-users': { requires: ['users.directory.read'] },
  'api-v1-list-roles': { requires: ['roles.manage'] },
  'api-v1-create-role': { requires: ['roles.manage'] },
  'api-v1-update-role': { requires: ['roles.manage'] },
  'api-v1-delete-role': { requires: ['roles.manage'] },
} as const satisfies Record<string, ApiOperation>;

export type ApiOperationId = keyof typeof API_OPERATIONS;

export type McpOperationId = {
  [K in ApiOperationId]: (typeof API_OPERATIONS)[K] extends { mcpTool: string }
    ? K
    : never;
}[ApiOperationId];
