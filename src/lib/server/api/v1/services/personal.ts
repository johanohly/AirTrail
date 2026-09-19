import { z } from 'zod';

import { db } from '$lib/db';
import {
  toCustomFieldDto,
  toShareDto,
  toVisitedCountryDto,
} from '$lib/api/v1/dto';
import {
  shareInputSchema,
  visitedCountryInputSchema,
} from '$lib/api/v1/schemas';
import { updatePreferencesSchema } from '$lib/zod/user';
import { requireApiScope } from '../access';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';

/*
 * The single implementation of every personal-data operation. Both the REST
 * routes and the MCP tools call these, so the two surfaces cannot drift on
 * scope enforcement, ordering, field projection or invariants -- which they had
 * already done at birth on share normalization, slug conflicts and custom-field
 * ordering.
 */

type ShareInput = z.infer<typeof shareInputSchema>;
type VisitedCountryInput = z.infer<typeof visitedCountryInputSchema>;
type PreferencesInput = z.infer<typeof updatePreferencesSchema>;

/** `showTracks` is meaningless without the map, and the renderer assumes it. */
const shareValues = (input: ShareInput) => ({
  ...input,
  expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  showTracks: input.showMap && input.showTracks,
});

export const listShares = async (principal: ApiPrincipal) => {
  requireApiScope(principal, 'shares.read');
  const rows = await db
    .selectFrom('publicShare')
    .selectAll()
    .where('userId', '=', principal.user.id)
    .orderBy('createdAt', 'desc')
    .execute();
  return rows.map(toShareDto);
};

export const createShare = async (
  principal: ApiPrincipal,
  input: ShareInput,
) => {
  requireApiScope(principal, 'shares.write');
  const exists = await db
    .selectFrom('publicShare')
    .select('id')
    .where('slug', '=', input.slug)
    .executeTakeFirst();
  if (exists)
    throw new ApiOperationError('conflict', 'Share slug already exists');
  const row = await db
    .insertInto('publicShare')
    .values({ ...shareValues(input), userId: principal.user.id })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toShareDto(row);
};

export const updateShare = async (
  principal: ApiPrincipal,
  id: number,
  input: ShareInput,
) => {
  requireApiScope(principal, 'shares.write');
  const conflict = await db
    .selectFrom('publicShare')
    .select('id')
    .where('slug', '=', input.slug)
    .where('id', '!=', id)
    .executeTakeFirst();
  if (conflict)
    throw new ApiOperationError('conflict', 'Share slug already exists');
  const row = await db
    .updateTable('publicShare')
    .set(shareValues(input))
    .where('id', '=', id)
    .where('userId', '=', principal.user.id)
    .returningAll()
    .executeTakeFirst();
  if (!row) throw new ApiOperationError('not_found', 'Share not found');
  return toShareDto(row);
};

export const deleteShare = async (principal: ApiPrincipal, id: number) => {
  requireApiScope(principal, 'shares.write');
  const deleted = await db
    .deleteFrom('publicShare')
    .where('id', '=', id)
    .where('userId', '=', principal.user.id)
    .executeTakeFirst();
  if (!deleted.numDeletedRows)
    throw new ApiOperationError('not_found', 'Share not found');
};

export const listVisitedCountries = async (principal: ApiPrincipal) => {
  requireApiScope(principal, 'visited_countries.read');
  const rows = await db
    .selectFrom('visitedCountry')
    .selectAll()
    .where('userId', '=', principal.user.id)
    .orderBy('code')
    .execute();
  return rows.map(toVisitedCountryDto);
};

export const setVisitedCountry = async (
  principal: ApiPrincipal,
  input: VisitedCountryInput,
) => {
  requireApiScope(principal, 'visited_countries.write');
  const row = await db
    .insertInto('visitedCountry')
    .values({ ...input, userId: principal.user.id })
    .onConflict((oc) =>
      oc
        .columns(['userId', 'code'])
        .doUpdateSet({ status: input.status, note: input.note }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
  return toVisitedCountryDto(row);
};

export const removeVisitedCountry = async (
  principal: ApiPrincipal,
  rawCode: string | null,
) => {
  requireApiScope(principal, 'visited_countries.write');
  const code = rawCode?.toUpperCase();
  if (!code || code.length !== 2)
    throw new ApiOperationError(
      'bad_request',
      'A two-letter country code is required',
    );
  await db
    .deleteFrom('visitedCountry')
    .where('userId', '=', principal.user.id)
    .where('code', '=', code)
    .execute();
  return code;
};

export const listCustomFields = async (principal: ApiPrincipal) => {
  requireApiScope(principal, 'custom_fields.read');
  const rows = await db
    .selectFrom('customFieldDefinition')
    .selectAll()
    .where('active', '=', true)
    .orderBy('entityType')
    .orderBy('order')
    .execute();
  return rows.map(toCustomFieldDto);
};

export const updatePreferences = async (
  principal: ApiPrincipal,
  input: PreferencesInput,
) => {
  requireApiScope(principal, 'preferences.write');
  // An empty patch compiles to `update "user" set`, which Postgres rejects.
  if (Object.keys(input).length === 0)
    throw new ApiOperationError(
      'bad_request',
      'At least one preference must be provided',
    );
  await db
    .updateTable('user')
    .set(input)
    .where('id', '=', principal.user.id)
    .execute();
  return { updated: true };
};
