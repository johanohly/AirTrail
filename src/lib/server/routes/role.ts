import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { PERMISSION_GROUPS } from '$lib/authorization/permissions';
import { db } from '$lib/db';
import { hasPermission } from '$lib/server/authorization/authorize';
import {
  getOAuthRoleSettings,
  replaceOAuthRoleSettings,
} from '$lib/server/authorization/oauth-role-mapping';
import {
  createRole,
  deleteRole,
  listRoles,
  setDefaultRole,
  updateRole,
} from '$lib/server/authorization/roles';
import { authedProcedure, permissionProcedure, router } from '$lib/server/trpc';
import { oauthRoleMappingSettingsSchema } from '$lib/zod/oauth-role-mapping';
import { roleInputSchema, roleUpdateSchema } from '$lib/zod/role';

const roleError = (error: unknown): never => {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: error instanceof Error ? error.message : 'Role operation failed',
  });
};

export const roleRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    if (
      !hasPermission(ctx.authorization, 'users.roles.assign') &&
      !hasPermission(ctx.authorization, 'roles.manage')
    ) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return { roles: await listRoles(), permissionGroups: PERMISSION_GROUPS };
  }),
  create: permissionProcedure('roles.manage')
    .input(roleInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createRole(input, ctx.authorization);
      } catch (error) {
        roleError(error);
      }
    }),
  update: permissionProcedure('roles.manage')
    .input(roleUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...role } = input;
        await updateRole(id, role, ctx.authorization);
        return true;
      } catch (error) {
        roleError(error);
      }
    }),
  delete: permissionProcedure('roles.manage')
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteRole(input, ctx.authorization);
      } catch (error) {
        roleError(error);
      }
    }),
  setDefault: permissionProcedure('roles.manage')
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      try {
        await setDefaultRole(input, ctx.authorization);
        return true;
      } catch (error) {
        roleError(error);
      }
    }),
  oauthMappings: permissionProcedure('instance.oauth.manage').query(
    getOAuthRoleSettings,
  ),
  updateOAuthMappings: permissionProcedure('instance.oauth.manage')
    .input(oauthRoleMappingSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await replaceOAuthRoleSettings(
          input.mode,
          input.mappings,
          ctx.authorization,
        );
        return true;
      } catch (error) {
        roleError(error);
      }
    }),
  audit: permissionProcedure('roles.manage').query(async () =>
    db
      .selectFrom('authorizationAudit')
      .leftJoin('user', 'user.id', 'authorizationAudit.actorUserId')
      .select([
        'authorizationAudit.id',
        'authorizationAudit.action',
        'authorizationAudit.targetType',
        'authorizationAudit.targetId',
        'authorizationAudit.createdAt',
        'user.displayName as actorName',
      ])
      .orderBy('authorizationAudit.createdAt', 'desc')
      .limit(50)
      .execute(),
  ),
});
