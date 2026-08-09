import type { Kysely } from 'kysely';

import type { DB } from '$lib/db/schema';
import type { PageUser, PublicUser, User } from '$lib/db/types';
import type { AuthorizationContext } from '$lib/server/authorization/context';

export { publicUserFields as publicUserSelect } from '$lib/db/types';

export const publicUserQuery = (db: Kysely<DB>) =>
  db
    .selectFrom('user')
    .leftJoin('accessRole', 'accessRole.id', 'user.roleId')
    .select([
      'user.id',
      'user.username',
      'user.displayName',
      'user.roleId',
      'user.isOwner',
      'user.roleAssignmentSource',
      'user.distanceUnit',
      'user.windSpeedUnit',
      'user.temperatureUnit',
      'user.pressureUnit',
      'user.timeFormat',
      'user.dateFormat',
      'user.weekStartsOn',
      'user.flightTimeDisplay',
      'accessRole.name as roleName',
    ]);

export const toPublicUser = (user: PublicUser): PublicUser => {
  const {
    id,
    username,
    displayName,
    roleId,
    roleName,
    isOwner,
    roleAssignmentSource,
    distanceUnit,
    windSpeedUnit,
    temperatureUnit,
    pressureUnit,
    timeFormat,
    dateFormat,
    weekStartsOn,
    flightTimeDisplay,
  } = user;

  return {
    id,
    username,
    displayName,
    roleId,
    roleName,
    isOwner,
    roleAssignmentSource,
    distanceUnit,
    windSpeedUnit,
    temperatureUnit,
    pressureUnit,
    timeFormat,
    dateFormat,
    weekStartsOn,
    flightTimeDisplay,
  };
};

export const toPageUser = (
  user: User,
  authorization: AuthorizationContext,
): PageUser => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  roleId: authorization.roleId,
  roleName: authorization.roleName,
  isOwner: authorization.isOwner,
  roleAssignmentSource: authorization.roleAssignmentSource,
  distanceUnit: user.distanceUnit,
  windSpeedUnit: user.windSpeedUnit,
  temperatureUnit: user.temperatureUnit,
  pressureUnit: user.pressureUnit,
  timeFormat: user.timeFormat,
  dateFormat: user.dateFormat,
  weekStartsOn: user.weekStartsOn,
  flightTimeDisplay: user.flightTimeDisplay,
  hasOAuthLinked: Boolean(user.oauthId),
});
