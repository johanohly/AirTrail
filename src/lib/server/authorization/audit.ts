import { sql, type Transaction } from 'kysely';

import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
};

export const writeAuthorizationAudit = async (
  input: AuditInput,
  connection: Transaction<DB> | typeof db = db,
) => {
  await connection
    .insertInto('authorizationAudit')
    .values({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before:
        input.before == null
          ? null
          : sql`${JSON.stringify(input.before)}::jsonb`,
      after:
        input.after == null ? null : sql`${JSON.stringify(input.after)}::jsonb`,
    })
    .execute();
};
