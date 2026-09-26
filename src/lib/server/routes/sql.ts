import { z } from 'zod';

import { TRPCError } from '@trpc/server';

import { pool } from '$lib/db';
import { isPublicDemo } from '$lib/server/demo/mode';
import { permissionProcedure, router } from '$lib/server/trpc';

export const sqlRouter = router({
  execute: permissionProcedure('tools.sql.execute')
    .input(z.string())
    .query(async ({ input }) => {
      // The permission is never granted in a demo; this also covers the owner.
      if (isPublicDemo()) throw new TRPCError({ code: 'FORBIDDEN' });
      try {
        const res = await pool.query(input);
        return { cols: res.fields.map((f) => f.name), rows: res.rows };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Query failed' };
      }
    }),
});
