import { env } from '$env/dynamic/private';
import { db } from '$lib/db';
import { writeOAuthRoleSettings } from './oauth-role-mapping';
import { listRoleOptions } from './roles';
import {
  oauthRoleMappingModeSchema,
  type OAuthRoleMappingInput,
  type OAuthRoleMappingMode,
} from '$lib/zod/oauth-role-mapping';

type RoleOption = { id: string; name: string };

/*
 * A deliberately small subset of the rule builder: one claim path from
 * UserInfo, matched with `contains` so it covers both `groups` arrays and
 * plain string claims. Anything richer stays in the settings UI. A mode of
 * `off` on its own keeps the saved rules, so pausing role mapping from the
 * environment doesn't delete rules built in the UI.
 */
export const parseOAuthRoleMappingEnv = (
  vars: { mode?: string; claim?: string; mappings?: string },
  roles: readonly RoleOption[],
): {
  mode: OAuthRoleMappingMode;
  mappings: OAuthRoleMappingInput[] | null;
} | null => {
  const mode = vars.mode?.trim() ?? '';
  const claim = vars.claim?.trim() ?? '';
  const pairs = (vars.mappings ?? '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean);
  if (!mode && !claim && !pairs.length) return null;

  const parsedMode = oauthRoleMappingModeSchema.safeParse(mode);
  if (!parsedMode.success) {
    throw new Error(
      `OAUTH_ROLE_MAPPING_MODE must be one of ${oauthRoleMappingModeSchema.options.join(', ')}`,
    );
  }
  if (!claim !== !pairs.length) {
    throw new Error(
      'OAUTH_ROLE_CLAIM and OAUTH_ROLE_MAPPINGS must be set together',
    );
  }
  if (!pairs.length) {
    if (parsedMode.data === 'off') return { mode: 'off', mappings: null };
    throw new Error(
      'OAUTH_ROLE_CLAIM and OAUTH_ROLE_MAPPINGS are required unless OAUTH_ROLE_MAPPING_MODE is off',
    );
  }

  const mappings = pairs.map((pair): OAuthRoleMappingInput => {
    const separator = pair.lastIndexOf('=');
    const claimValue = separator === -1 ? '' : pair.slice(0, separator).trim();
    const roleRef = separator === -1 ? '' : pair.slice(separator + 1).trim();
    if (!claimValue || !roleRef) {
      throw new Error(
        `OAUTH_ROLE_MAPPINGS entry "${pair}" must look like claimValue=Role`,
      );
    }
    const role =
      roles.find(({ id }) => id === roleRef) ??
      roles.find(({ name }) => name === roleRef);
    if (!role) {
      throw new Error(
        `OAUTH_ROLE_MAPPINGS references unknown role "${roleRef}". Available roles: ${roles.map(({ name }) => name).join(', ')}`,
      );
    }
    return {
      name: '',
      enabled: true,
      claimSource: 'userinfo',
      claimPath: claim.startsWith('/') ? claim : `/${claim}`,
      operator: 'contains',
      claimValue,
      roleId: role.id,
    };
  });

  return { mode: parsedMode.data, mappings };
};

let envConfigured = false;

export const oauthRoleMappingEnvConfigured = () => envConfigured;

export const applyOAuthRoleMappingEnv = async () => {
  const settings = parseOAuthRoleMappingEnv(
    {
      mode: env.OAUTH_ROLE_MAPPING_MODE,
      claim: env.OAUTH_ROLE_CLAIM,
      mappings: env.OAUTH_ROLE_MAPPINGS,
    },
    await listRoleOptions(),
  );
  if (!settings) return;

  await db
    .transaction()
    .execute((trx) =>
      writeOAuthRoleSettings(trx, settings.mode, settings.mappings),
    );
  envConfigured = true;
  console.log('Loaded OAuth role mapping from .env');
};
