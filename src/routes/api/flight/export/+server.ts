import { parseFlightScope } from '$lib/server/api/v1/query';
import { exportFlights } from '$lib/server/api/v1/services/flights';
import { apiError, legacyApiRoute } from '$lib/server/utils/api';
import { backupDownload, parseBackupFormat } from '$lib/server/utils/backup';

export const GET = legacyApiRoute(async ({ principal, event }) => {
  const format = parseBackupFormat(event.url.searchParams.get('format'));
  if (!format) {
    return apiError('Invalid format', 400);
  }

  const backup = await exportFlights(
    principal,
    parseFlightScope(event.url.searchParams),
  );
  return backupDownload(backup, format);
});
