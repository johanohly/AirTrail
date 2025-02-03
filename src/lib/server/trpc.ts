import { TRPCError, initTRPC } from '@trpc/server';

import type { Context } from './context';

import { transformer } from '$lib/trpc/transformer';

const t = initTRPC.context<Context>().create({
  transformer,
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const authedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user,
      session: ctx.session,
    },
  });
});

export const adminProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'user') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const ownerProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});
