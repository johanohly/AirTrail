import type { RequestHandler } from './$types';

import {
  generateBackup,
  serializeBackup,
  type BackupFormat,
  type BackupScope,
} from '$lib/server/utils/backup';
import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';

const contentTypes: Record<BackupFormat, string> = {
  json: 'application/json; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
};

const parseFormat = (value: string | null): BackupFormat | null => {
  if (!value || value === 'json') return 'json';
  if (value === 'yaml' || value === 'yml') return 'yaml';
  return null;
};

const parseScope = (value: string | null): BackupScope | null => {
  if (!value || value === 'mine') return 'mine';
  if (value === 'user' || value === 'all') return value;
  return null;
};

export const GET: RequestHandler = async ({ request, url }) => {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const format = parseFormat(url.searchParams.get('format'));
  if (!format) {
    return apiError('Invalid format', 400);
  }

  const scope = parseScope(url.searchParams.get('scope'));
  if (!scope) {
    return apiError('Invalid scope', 400);
  }

  if (user.role === 'user' && scope !== 'mine') {
    return apiError('Forbidden', 403);
  }

  const userId =
    scope === 'mine' ? user.id : url.searchParams.get('userId') || undefined;
  if (scope === 'user' && !userId) {
    return apiError('A userId query parameter is required for user scope', 400);
  }

  const backup = await generateBackup({ scope, userId });
  const filename = `airtrail.${format === 'yaml' ? 'yaml' : 'json'}`;

  return new Response(serializeBackup(backup, format), {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': contentTypes[format],
    },
  });
};
