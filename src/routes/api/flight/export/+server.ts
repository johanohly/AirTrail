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
import {
  apiError,
  authenticateApiKey,
  forbidden,
  unauthorized,
} from '$lib/server/utils/api';

const contentTypes: Record<BackupFormat, string> = {
  json: 'application/json; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
};

const parseFormat = (value: string | null): BackupFormat | null => {
  if (!value || value === 'json') return 'json';
  if (value === 'yaml' || value === 'yml') return 'yaml';
  return null;
};

export const GET: RequestHandler = async ({ request, url }) => {
  const authentication = await authenticateApiKey(request);
  if (!authentication) {
    return unauthorized();
  }
  const { user, authorization } = authentication;

  const format = parseFormat(url.searchParams.get('format'));
  if (!format) {
    return apiError('Invalid format', 400);
  }

  const parsedScope = parseFlightScopeSearchParams(url.searchParams);
  if (!parsedScope.success) {
    return apiError(
      parsedScope.reason === 'missing_user'
        ? 'A userId query parameter is required for user scope'
        : 'Invalid scope',
      400,
    );
  }

  if (!canExportFlights(authorization, parsedScope.data)) return forbidden();

  const backup = await generateBackup(
    resolveFlightScope(parsedScope.data, user.id),
  );
  const filename = `airtrail.${format === 'yaml' ? 'yaml' : 'json'}`;

  return new Response(serializeBackup(backup, format), {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': contentTypes[format],
    },
  });
};
