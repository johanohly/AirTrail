import type { z } from 'zod';

import {
  toCustomFieldDto,
  toShareDto,
  toVisitedCountryDto,
} from '$lib/api/v1/dto';
import type {
  shareInputSchema,
  visitedCountryInputSchema,
} from '$lib/api/v1/schemas';
import { db } from '$lib/db';
import {
  deleteShare as deleteUserShare,
  insertShare,
  listUserShares,
  patchShare,
  ShareSlugTakenError,
} from '$lib/server/utils/share';
import { updateUserPreferences } from '$lib/server/utils/user';
import { isKnownCountryCode } from '$lib/utils/data/countries';
import {
  listVisitedCountries as listUserVisitedCountries,
  removeVisitedCountry as removeUserVisitedCountry,
  setVisitedCountry as setUserVisitedCountry,
} from '$lib/server/utils/visited-countries';
import type { updatePreferencesSchema } from '$lib/zod/user';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';

type ShareInput = z.infer<typeof shareInputSchema>;

const shareValues = ({ expiresAt, ...input }: ShareInput) => ({
  ...input,
  expiresAt: expiresAt ? new Date(expiresAt) : null,
});

const slugConflict = (error: unknown): never => {
  if (error instanceof ShareSlugTakenError)
    throw new ApiOperationError('conflict', 'Share slug already exists');
  throw error;
};

export const listShares = async (principal: ApiPrincipal) =>
  (await listUserShares(principal.user.id)).map(toShareDto);

export const createShare = async (principal: ApiPrincipal, input: ShareInput) =>
  toShareDto(
    await insertShare(principal.user.id, shareValues(input)).catch(
      slugConflict,
    ),
  );

export const updateShare = async (
  principal: ApiPrincipal,
  id: number,
  input: ShareInput,
) => {
  const row = await patchShare(principal.user.id, id, shareValues(input)).catch(
    slugConflict,
  );
  if (!row) throw new ApiOperationError('not_found', 'Share not found');
  return toShareDto(row);
};

export const deleteShare = async (principal: ApiPrincipal, id: number) => {
  if (!(await deleteUserShare(principal.user.id, id)))
    throw new ApiOperationError('not_found', 'Share not found');
};

export const listVisitedCountries = async (principal: ApiPrincipal) =>
  (await listUserVisitedCountries(principal.user.id)).map(toVisitedCountryDto);

export const setVisitedCountry = async (
  principal: ApiPrincipal,
  input: z.infer<typeof visitedCountryInputSchema>,
) => toVisitedCountryDto(await setUserVisitedCountry(principal.user.id, input));

export const removeVisitedCountry = async (
  principal: ApiPrincipal,
  rawCode: string | null,
) => {
  const code = rawCode?.toUpperCase();
  if (!code || !isKnownCountryCode(code))
    throw new ApiOperationError(
      'bad_request',
      'A known country code is required',
    );
  await removeUserVisitedCountry(principal.user.id, code);
  return code;
};

export const listCustomFields = async () => {
  const rows = await db
    .selectFrom('customFieldDefinition')
    .selectAll()
    .where('active', '=', true)
    .orderBy('entityType')
    .orderBy('order')
    .orderBy('label')
    .execute();
  return rows.map(toCustomFieldDto);
};

export const updatePreferences = async (
  principal: ApiPrincipal,
  input: z.infer<typeof updatePreferencesSchema>,
) => {
  await updateUserPreferences(principal.user.id, input);
  return { updated: true };
};
