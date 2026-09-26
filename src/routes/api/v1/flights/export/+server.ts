import { backupDownload, parseBackupFormat } from '$lib/server/utils/backup';
import { ApiOperationError } from '$lib/server/api/v1/errors';
import { parseFlightScope } from '$lib/server/api/v1/query';
import { apiRoute } from '$lib/server/api/v1/route';
import { exportFlights } from '$lib/server/api/v1/services/flights';

export const GET = apiRoute(
  'api-v1-export-flights',
  async ({ principal, event }) => {
    const format = parseBackupFormat(event.url.searchParams.get('format'));
    if (!format) throw new ApiOperationError('bad_request', 'Invalid format');
    const backup = await exportFlights(
      principal,
      parseFlightScope(event.url.searchParams),
    );
    return backupDownload(backup, format, {
      'Cache-Control': 'private, no-store',
    });
  },
);
