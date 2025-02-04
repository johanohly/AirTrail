import { z } from 'zod';

import { pool } from '$lib/db';
import { ownerProcedure, router } from '$lib/server/trpc';

export const sqlRouter = router({
  execute: ownerProcedure.input(z.string()).query(async ({ input }) => {
    try {
      const res = await pool.query(input);
      return { cols: res.fields.map((f) => f.name), rows: res.rows };
    } catch (err) {
      return { error: err.message };
    }
  }),
});
