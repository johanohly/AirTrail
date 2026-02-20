import type { Kysely } from 'kysely';
import { sql } from 'kysely';

import type { DB } from '$lib/db/schema';

type EntityType = 'flight';
type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'airport'
  | 'airline'
  | 'aircraft';

type Validation = {
  regex?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
};

type InputValueArray = Array<{ fieldId: number; value: unknown | null }>;
type InputValueRecord = Record<string, unknown>;
type IncomingValues = InputValueArray | InputValueRecord | null | undefined;

const TEXT_LIKE_TYPES = new Set<FieldType>(['text', 'textarea']);
const ENTITY_TYPES = new Set<FieldType>(['airport', 'airline', 'aircraft']);

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

const getValidation = (value: unknown): Validation | null => {
  if (!value || typeof value !== 'object') return null;
  return value as Validation;
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

const validateValue = (def: Definition, value: unknown): string | null => {
  if (def.required && (value === undefined || value === null || value === '')) {
    return `Custom field "${def.label}" is required`;
  }

  if (value == null) return null;

  if (TEXT_LIKE_TYPES.has(def.fieldType) && typeof value !== 'string') {
    return `Custom field "${def.label}" must be text`;
  }

  if (def.fieldType === 'number' && typeof value !== 'number') {
    return `Custom field "${def.label}" must be a number`;
  }

  if (def.fieldType === 'boolean' && typeof value !== 'boolean') {
    return `Custom field "${def.label}" must be true or false`;
  }

  if (def.fieldType === 'date' && typeof value !== 'string') {
    return `Custom field "${def.label}" must be a date string`;
  }

  if (def.fieldType === 'select') {
    if (typeof value !== 'string') {
      return `Custom field "${def.label}" must be one of its options`;
    }

    const options = Array.isArray(def.options)
      ? def.options.filter((x): x is string => typeof x === 'string')
      : [];
    if (!options.includes(value)) {
      return `Custom field "${def.label}" must be one of its options`;
    }
  }

  if (ENTITY_TYPES.has(def.fieldType) && typeof value !== 'number') {
    return `Custom field "${def.label}" must use a numeric ID`;
  }

  const validation = getValidation(def.validationJson);
  if (!validation) return null;

  if (TEXT_LIKE_TYPES.has(def.fieldType) && typeof value === 'string') {
    if (validation.regex) {
      try {
        const re = new RegExp(validation.regex);
        if (!re.test(value)) {
          return `Custom field "${def.label}" does not match its pattern`;
        }
      } catch {
        return `Custom field "${def.label}" has an invalid regex pattern`;
      }
    }

    if (
      typeof validation.minLength === 'number' &&
      value.length < validation.minLength
    ) {
      return `Custom field "${def.label}" is shorter than minimum length`;
    }

    if (
      typeof validation.maxLength === 'number' &&
      value.length > validation.maxLength
    ) {
      return `Custom field "${def.label}" is longer than maximum length`;
    }
  }

  if (def.fieldType === 'number' && typeof value === 'number') {
    if (typeof validation.min === 'number' && value < validation.min) {
      return `Custom field "${def.label}" is lower than minimum value`;
    }

    if (typeof validation.max === 'number' && value > validation.max) {
      return `Custom field "${def.label}" is higher than maximum value`;
    }
  }

  return null;
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

  const incomingByFieldId = new Map<number, unknown | null>();
  for (const entry of normalizeIncomingEntries(values)) {
    if ('fieldId' in entry) {
      if (defsById.has(entry.fieldId)) {
        incomingByFieldId.set(entry.fieldId, entry.value);
      }
      continue;
    }

    const byKey = defsByKey.get(entry.key);
    if (byKey) {
      incomingByFieldId.set(byKey.id, entry.value);
      continue;
    }

    const asId = Number(entry.key);
    if (Number.isFinite(asId) && defsById.has(asId)) {
      incomingByFieldId.set(asId, entry.value);
    }
  }

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

  const mergedValues = new Map<number, unknown>(existingValues);
  for (const [fieldId, value] of defaultsToPersist) {
    mergedValues.set(fieldId, value);
  }
  for (const [fieldId, value] of incomingByFieldId) {
    if (value === null || value === '') {
      mergedValues.delete(fieldId);
    } else {
      mergedValues.set(fieldId, value);
    }
  }

  for (const def of defs) {
    const message = validateValue(def, mergedValues.get(def.id));
    if (message) {
      throw new CustomFieldValidationError(message);
    }
  }

  const entriesToPersist = new Map<number, unknown | null>();
  for (const [fieldId, value] of defaultsToPersist) {
    entriesToPersist.set(fieldId, value);
  }
  for (const [fieldId, value] of incomingByFieldId) {
    entriesToPersist.set(fieldId, value);
  }

  for (const [fieldId, value] of entriesToPersist) {
    if (value === null || value === '') {
      await db
        .deleteFrom('customFieldValue')
        .where('fieldId', '=', fieldId)
        .where('entityType', '=', entityType)
        .where('entityId', '=', entityId)
        .execute();
      continue;
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
  }
};
