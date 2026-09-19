import { serializeBackup, type BackupFormat } from '$lib/server/utils/backup';
import { ApiOperationError } from '$lib/server/api/v1/errors';
import { parseFlightScope } from '$lib/server/api/v1/query';
import { apiRoute } from '$lib/server/api/v1/route';
import { exportFlights } from '$lib/server/api/v1/services/flights';

const contentTypes: Record<BackupFormat, string> = {
  json: 'application/json; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
};

const parseFormat = (value: string): BackupFormat => {
  if (value === 'json') return 'json';
  if (value === 'yaml' || value === 'yml') return 'yaml';
  throw new ApiOperationError('bad_request', 'Invalid format');
};

export const GET = apiRoute(
  'flight.export.own',
  async ({ principal, event }) => {
    const format = parseFormat(event.url.searchParams.get('format') ?? 'json');
    const backup = await exportFlights(
      principal,
      parseFlightScope(
        event.url.searchParams.get('scope'),
        event.url.searchParams.get('userId'),
      ),
    );
    return new Response(serializeBackup(backup, format), {
      headers: {
        'Content-Disposition': `attachment; filename="airtrail.${format}"`,
        'Content-Type': contentTypes[format],
        'Cache-Control': 'private, no-store',
      },
    });
  },
);
