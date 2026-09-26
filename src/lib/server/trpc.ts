import { TRPCError, initTRPC } from '@trpc/server';

import type { Context } from './context';

import { transformer } from '$lib/trpc/transformer';
import type { Permission } from '$lib/authorization/permissions';
import { hasPermission } from '$lib/server/authorization/authorize';

const t = initTRPC.context<Context>().create({
  transformer,
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const authedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user || !ctx.authorization) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user,
      session: ctx.session,
      authorization: ctx.authorization,
    },
  });
});

export const permissionProcedure = (permission: Permission) =>
  authedProcedure.use(({ ctx, next }) => {
    if (!hasPermission(ctx.authorization, permission)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  });
