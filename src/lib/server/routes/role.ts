import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { PERMISSION_GROUPS } from '$lib/authorization/permissions';
import {
  AuthorizationError,
  hasPermission,
} from '$lib/server/authorization/authorize';
import {
  getOAuthManagedUserCount,
  getOAuthRoleSettings,
  replaceOAuthRoleSettings,
  testOAuthRoleMappings,
} from '$lib/server/authorization/oauth-role-mapping';
import {
  createRole,
  deleteRole,
  listAssignableRoleOptions,
  listRoleOptions,
  listRoles,
  RoleOperationError,
  setDefaultRole,
  updateRole,
} from '$lib/server/authorization/roles';
import { authedProcedure, permissionProcedure, router } from '$lib/server/trpc';
import {
  oauthRoleMappingSettingsSchema,
  oauthRoleMappingTestSchema,
} from '$lib/zod/oauth-role-mapping';
import { roleInputSchema, roleUpdateSchema } from '$lib/zod/role';

const roleErrorCodes = {
  conflict: 'CONFLICT',
  not_found: 'NOT_FOUND',
  invalid: 'BAD_REQUEST',
} satisfies Record<
  RoleOperationError['kind'],
  'CONFLICT' | 'NOT_FOUND' | 'BAD_REQUEST'
>;

const roleError = (error: unknown): never => {
  if (error instanceof AuthorizationError) {
    throw new TRPCError({
      code: error.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      message: error.message,
    });
  }
  if (error instanceof RoleOperationError) {
    const code = roleErrorCodes[error.kind];
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
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
  assignableOptions: permissionProcedure('users.roles.assign').query(
    async ({ ctx }) => listAssignableRoleOptions(ctx.authorization),
  ),
  oauthRoleOptions: permissionProcedure('instance.oauth.manage').query(
    listRoleOptions,
  ),
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
    async () => ({
      ...(await getOAuthRoleSettings()),
      oauthManagedUserCount: await getOAuthManagedUserCount(),
    }),
  ),
  testOAuthMappings: permissionProcedure('instance.oauth.manage')
    .input(oauthRoleMappingTestSchema)
    .mutation(async ({ input }) => testOAuthRoleMappings(input)),
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
});
