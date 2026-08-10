import type { Kysely } from 'kysely';
import { sql } from 'kysely';

import type { DB } from '$lib/db/schema';
import {
  isCustomFieldValueEmpty,
  type EntityType,
  type FieldType,
  validateCustomFieldValue,
} from '$lib/utils/custom-fields';

type InputValueArray = Array<{ fieldId: number; value?: unknown | null }>;
type InputValueRecord = Record<string, unknown>;
type IncomingValues = InputValueArray | InputValueRecord | null | undefined;

export class CustomFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomFieldValidationError';
  }
}

type NormalizedIncomingEntry =
  | { fieldId: number; value: unknown | null }
  | { key: string; value: unknown | null };

const normalizeIncomingEntries = (values: IncomingValues) => {
  const normalized: NormalizedIncomingEntry[] = [];

  if (!values) return normalized;

  if (Array.isArray(values)) {
    for (const entry of values) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !Number.isFinite(entry.fieldId)
      ) {
        continue;
      }
      normalized.push({
        fieldId: Number(entry.fieldId),
        value: entry.value ?? null,
      });
    }
    return normalized;
  }

  for (const [key, value] of Object.entries(values)) {
    normalized.push({ key, value: value ?? null });
  }

  return normalized;
};

const toJsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`;

type Definition = {
  id: number;
  key: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  defaultValue: unknown;
  options: unknown;
  validationJson: unknown;
};

/** Resolve incoming entries (by fieldId or key) to a map of fieldId → value. */
const resolveIncomingValues = (
  values: IncomingValues,
  defsById: Map<number, Definition>,
  defsByKey: Map<string, Definition>,
): Map<number, unknown | null> => {
  const result = new Map<number, unknown | null>();
  for (const entry of normalizeIncomingEntries(values)) {
    const fieldId = resolveFieldId(entry, defsById, defsByKey);
    if (fieldId != null) result.set(fieldId, entry.value);
  }
  return result;
};

const resolveFieldId = (
  entry: NormalizedIncomingEntry,
  defsById: Map<number, Definition>,
  defsByKey: Map<string, Definition>,
): number | null => {
  if ('fieldId' in entry) {
    return defsById.has(entry.fieldId) ? entry.fieldId : null;
  }
  const byKey = defsByKey.get(entry.key);
  if (byKey) return byKey.id;

  const asId = Number(entry.key);
  return Number.isFinite(asId) && defsById.has(asId) ? asId : null;
};

/**
 * Merge existing, default, and incoming values into a single map
 * representing the final state for validation.
 */
const mergeValues = (
  existingValues: Map<number, unknown>,
  defaults: Map<number, unknown>,
  incoming: Map<number, unknown | null>,
): Map<number, unknown> => {
  const merged = new Map<number, unknown>(existingValues);
  for (const [fieldId, value] of defaults) {
    merged.set(fieldId, value);
  }
  for (const [fieldId, value] of incoming) {
    if (isCustomFieldValueEmpty(value)) {
      merged.delete(fieldId);
    } else {
      merged.set(fieldId, value);
    }
  }
  return merged;
};

/** Write or delete a single custom field value row. */
const persistEntry = async (
  db: Kysely<DB>,
  entityType: EntityType,
  entityId: string,
  fieldId: number,
  value: unknown | null,
) => {
  if (isCustomFieldValueEmpty(value)) {
    await db
      .deleteFrom('customFieldValue')
      .where('fieldId', '=', fieldId)
      .where('entityType', '=', entityType)
      .where('entityId', '=', entityId)
      .execute();
    return;
  }

  const now = new Date();
  await db
    .insertInto('customFieldValue')
    .values({
      fieldId,
      entityType,
      entityId,
      value: toJsonb(value),
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['fieldId', 'entityType', 'entityId']).doUpdateSet({
        value: toJsonb(value),
        updatedAt: now,
      }),
    )
    .execute();
};

export const persistEntityCustomFields = async (
  db: Kysely<DB>,
  {
    entityType,
    entityId,
    values,
  }: {
    entityType: EntityType;
    entityId: string;
    values?: IncomingValues;
  },
) => {
  const defs = await db
    .selectFrom('customFieldDefinition')
    .select([
      'id',
      'key',
      'label',
      'fieldType',
      'required',
      'defaultValue',
      'options',
      'validationJson',
    ])
    .where('entityType', '=', entityType)
    .where('active', '=', true)
    .execute();

  const defsById = new Map(defs.map((d) => [d.id, d]));
  const defsByKey = new Map(defs.map((d) => [d.key, d]));

  const existingRows = await db
    .selectFrom('customFieldValue')
    .select(['fieldId', 'value'])
    .where('entityType', '=', entityType)
    .where('entityId', '=', entityId)
    .execute();

  const existingValues = new Map<number, unknown>(
    existingRows.map((row) => [row.fieldId, row.value]),
  );

  const incomingByFieldId = resolveIncomingValues(values, defsById, defsByKey);

  // Auto-apply defaults for fields that are missing both saved and incoming values.
  const defaultsToPersist = new Map<number, unknown>();
  for (const def of defs) {
    if (
      def.defaultValue != null &&
      !existingValues.has(def.id) &&
      !incomingByFieldId.has(def.id)
    ) {
      defaultsToPersist.set(def.id, def.defaultValue);
    }
  }

  const mergedValues = mergeValues(
    existingValues,
    defaultsToPersist,
    incomingByFieldId,
  );

  for (const def of defs) {
    const message = validateCustomFieldValue(def, mergedValues.get(def.id));
    if (message) {
      const detail =
        message === `${def.label} is required`
          ? 'is required'
          : `${message.charAt(0).toLowerCase()}${message.slice(1)}`;
      throw new CustomFieldValidationError(
        `Custom field "${def.label}" ${detail}`,
      );
    }
  }

  const entriesToPersist = new Map<number, unknown | null>(defaultsToPersist);
  for (const [fieldId, value] of incomingByFieldId) {
    entriesToPersist.set(fieldId, value);
  }

  for (const [fieldId, value] of entriesToPersist) {
    await persistEntry(db, entityType, entityId, fieldId, value);
  }
};
