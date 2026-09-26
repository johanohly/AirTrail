import type { Kysely } from 'kysely';
import { isDeepStrictEqual } from 'node:util';
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
type IncomingValues = InputValueArray | InputValueRecord | null;

export class CustomFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomFieldValidationError';
  }
}

type NormalizedIncomingEntry =
  | { fieldId: number; value: unknown | null }
  | { key: string; value: unknown | null };

const normalizeIncomingEntries = (values: IncomingValues | undefined) => {
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
  values: IncomingValues | undefined,
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

export const getCustomFieldEntriesToPersist = (
  existingValues: ReadonlyMap<number, unknown>,
  defaultsToPersist: ReadonlyMap<number, unknown>,
  incomingValues: ReadonlyMap<number, unknown | null>,
) => {
  const entries = new Map<number, unknown | null>(defaultsToPersist);
  for (const [fieldId, value] of incomingValues) {
    const changesExistingValue = isCustomFieldValueEmpty(value)
      ? existingValues.has(fieldId)
      : !existingValues.has(fieldId) ||
        !isDeepStrictEqual(existingValues.get(fieldId), value);
    if (changesExistingValue) entries.set(fieldId, value);
  }
  return entries;
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
  const plan = await prepareEntityCustomFieldPlan(db, {
    entityType,
    entities: [{ entityId, values }],
  });
  validateEntityCustomFieldPlan(plan);
  await persistEntityCustomFieldPlan(db, plan, [entityId]);
};

type PlannedCustomFieldEntity = {
  changed: boolean;
  mergedValues: Map<number, unknown>;
  entriesToPersist: Map<number, unknown | null>;
};

export type EntityCustomFieldPlan = {
  entityType: EntityType;
  definitions: Definition[];
  entities: PlannedCustomFieldEntity[];
};

export const prepareEntityCustomFieldPlan = async (
  db: Kysely<DB>,
  {
    entityType,
    entities,
  }: {
    entityType: EntityType;
    entities: Array<{
      entityId: string | null;
      values?: IncomingValues;
    }>;
  },
): Promise<EntityCustomFieldPlan> => {
  const definitions = await db
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

  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const definitionsByKey = new Map(
    definitions.map((definition) => [definition.key, definition]),
  );
  const entityIds = [
    ...new Set(
      entities.flatMap(({ entityId }) => (entityId === null ? [] : [entityId])),
    ),
  ];
  const existingRows =
    entityIds.length === 0
      ? []
      : await db
          .selectFrom('customFieldValue')
          .select(['entityId', 'fieldId', 'value'])
          .where('entityType', '=', entityType)
          .where('entityId', 'in', entityIds)
          .execute();
  const existingByEntity = new Map<string, Map<number, unknown>>();
  for (const row of existingRows) {
    const existing = existingByEntity.get(row.entityId) ?? new Map();
    existing.set(row.fieldId, row.value);
    existingByEntity.set(row.entityId, existing);
  }

  const plannedEntities = entities.map(({ entityId, values }) => {
    const existingValues =
      entityId === null
        ? new Map<number, unknown>()
        : (existingByEntity.get(entityId) ?? new Map<number, unknown>());
    const incomingValues = resolveIncomingValues(
      values,
      definitionsById,
      definitionsByKey,
    );

    const defaultsToPersist = new Map<number, unknown>();
    for (const definition of definitions) {
      if (
        definition.defaultValue != null &&
        !existingValues.has(definition.id) &&
        !incomingValues.has(definition.id)
      ) {
        defaultsToPersist.set(definition.id, definition.defaultValue);
      }
    }

    const entriesToPersist = getCustomFieldEntriesToPersist(
      existingValues,
      defaultsToPersist,
      incomingValues,
    );

    return {
      changed: entriesToPersist.size > 0,
      mergedValues: mergeValues(
        existingValues,
        defaultsToPersist,
        incomingValues,
      ),
      entriesToPersist,
    };
  });

  return { entityType, definitions, entities: plannedEntities };
};

export const validateEntityCustomFieldPlan = (plan: EntityCustomFieldPlan) => {
  for (const entity of plan.entities) {
    for (const definition of plan.definitions) {
      const message = validateCustomFieldValue(
        definition,
        entity.mergedValues.get(definition.id),
      );
      if (!message) continue;
      const detail =
        message === `${definition.label} is required`
          ? 'is required'
          : `${message.charAt(0).toLowerCase()}${message.slice(1)}`;
      throw new CustomFieldValidationError(
        `Custom field "${definition.label}" ${detail}`,
      );
    }
  }
};

export const persistEntityCustomFieldPlan = async (
  db: Kysely<DB>,
  plan: EntityCustomFieldPlan,
  entityIds: readonly string[],
) => {
  if (entityIds.length !== plan.entities.length) {
    throw new Error('Custom-field plan does not match its persisted entities');
  }
  for (const [index, entity] of plan.entities.entries()) {
    const entityId = entityIds[index];
    if (!entityId) {
      throw new Error('Custom-field entity ID is missing');
    }
    for (const [fieldId, value] of entity.entriesToPersist) {
      await persistEntry(db, plan.entityType, entityId, fieldId, value);
    }
  }
};
