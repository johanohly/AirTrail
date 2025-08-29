import { z } from 'zod';

import { authedProcedure, publicProcedure, router } from '../trpc';

import {
  shareCreateSchema,
  shareUpdateSchema,
  listUserShares,
  createShare,
  updateShare,
  deleteShare,
  getPublicShareData,
} from '$lib/server/utils/share';

export const shareRouter = router({
  // List user's shares
  list: authedProcedure.query(async ({ ctx: { user } }) => {
    return await listUserShares(user.id);
  }),

  // Create new share
  create: authedProcedure
    .input(shareCreateSchema)
    .mutation(async ({ ctx: { user }, input }) => {
      return await createShare(user.id, input);
    }),

  // Update existing share
  update: authedProcedure
    .input(shareUpdateSchema)
    .mutation(async ({ ctx: { user }, input }) => {
      return await updateShare(user.id, input);
    }),

  // Delete share
  delete: authedProcedure
    .input(z.string())
    .mutation(async ({ ctx: { user }, input }) => {
      return await deleteShare(user.id, input);
    }),

  // Get public share data (no auth required)
  public: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return await getPublicShareData(input.slug);
    }),
});
