import type { RequestHandler } from './$types';
import {
  generateBackup,
  serializeBackup,
  type BackupFormat,
} from '$lib/server/utils/backup';
import {
  parseFlightScopeSearchParams,
  resolveFlightScope,
} from '$lib/flight-scope';
import { canExportFlights } from '$lib/server/authorization/flight';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Error, apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { principalHasScope } from '$lib/server/api/v1/principal';
import { apiV1Data } from '$lib/server/api/v1/response';

const contentTypes: Record<BackupFormat, string> = {
  json: 'application/json; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
};
export const GET: RequestHandler = async (event) => {
  const principal = await authenticateRestPrincipal(event);
  if (!principal) return apiV1Unauthorized('flight.export.own');
  const formatValue = event.url.searchParams.get('format') ?? 'json';
  const format: BackupFormat | null =
    formatValue === 'json'
      ? 'json'
      : formatValue === 'yaml' || formatValue === 'yml'
        ? 'yaml'
        : null;
  if (!format) return apiV1Error('bad_request', 'Invalid format', 400);
  const parsed = parseFlightScopeSearchParams(event.url.searchParams);
  if (!parsed.success) return apiV1Error('bad_request', 'Invalid scope', 400);
  const own =
    parsed.data.scope === 'mine' ||
    (parsed.data.scope === 'user' && parsed.data.userId === principal.user.id);
  const required = own ? 'flight.export.own' : 'flight.export.any';
  if (
    !principalHasScope(principal, required) ||
    !canExportFlights(principal.authorization, parsed.data)
  )
    return apiV1Error('forbidden', 'Cannot export this scope', 403);
  const backup = await generateBackup(
    resolveFlightScope(parsed.data, principal.user.id),
  );
  return new Response(serializeBackup(backup, format), {
    headers: {
      'Content-Disposition': `attachment; filename="airtrail.${format}"`,
      'Content-Type': contentTypes[format],
      'Cache-Control': 'private, no-store',
    },
  });
};
