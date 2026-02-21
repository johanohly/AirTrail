export {
  isEntityType,
  isTextLike,
  normalizeOptions,
} from '$lib/utils/custom-fields';
import type { DefinitionItem, EditingState, Validation } from './types';

import {
  isEntityType,
  isTextLike,
  normalizeOptions,
} from '$lib/utils/custom-fields';

export const parseValidation = (value: unknown): Validation => {
  if (!value || typeof value !== 'object') return {};

  const v = value as Record<string, unknown>;
  return {
    regex: typeof v.regex === 'string' ? v.regex : undefined,
    min: typeof v.min === 'number' ? v.min : undefined,
    max: typeof v.max === 'number' ? v.max : undefined,
    minLength: typeof v.minLength === 'number' ? v.minLength : undefined,
    maxLength: typeof v.maxLength === 'number' ? v.maxLength : undefined,
  };
};

export const toKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9\s_-]/g, '')
    .replaceAll(/[\s-]+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '');

export const createBlankEditing = (order: number): EditingState => ({
  key: '',
  label: '',
  description: '',
  fieldType: 'text',
  required: false,
  active: true,
  order,
  optionsText: '',
  defaultValue: null,
  validationRegex: '',
  validationMin: '',
  validationMax: '',
  validationMinLength: '',
  validationMaxLength: '',
});

export const itemToEditing = (item: DefinitionItem): EditingState => {
  const validation = parseValidation(item.validationJson);

  return {
    id: item.id,
    key: item.key,
    label: item.label,
    description: item.description ?? '',
    fieldType: item.fieldType,
    required: item.required,
    active: item.active,
    order: item.order,
    optionsText: normalizeOptions(item.options).join('\n'),
    defaultValue: item.defaultValue ?? null,
    validationRegex: validation.regex ?? '',
    validationMin:
      typeof validation.min === 'number' ? String(validation.min) : '',
    validationMax:
      typeof validation.max === 'number' ? String(validation.max) : '',
    validationMinLength:
      typeof validation.minLength === 'number'
        ? String(validation.minLength)
        : '',
    validationMaxLength:
      typeof validation.maxLength === 'number'
        ? String(validation.maxLength)
        : '',
  };
};

/** Read the current default as a raw value for use in CustomFieldInput. */
export const getPreviewValue = (editing: EditingState): unknown => {
  return editing.defaultValue;
};

/** Write a raw value from CustomFieldInput back into the editing state. */
export const setPreviewValue = (
  editing: EditingState,
  value: unknown,
): void => {
  editing.defaultValue = value;
};

/** Normalize the default value for the payload sent to the server. */
export const getDefaultValue = (editing: EditingState): unknown => {
  const { defaultValue, fieldType } = editing;

  if (defaultValue == null) return null;

  if (isTextLike(fieldType)) {
    return typeof defaultValue === 'string' && defaultValue.trim()
      ? defaultValue.trim()
      : null;
  }

  if (fieldType === 'number') {
    return typeof defaultValue === 'number' ? defaultValue : null;
  }

  if (fieldType === 'boolean') {
    return typeof defaultValue === 'boolean' ? defaultValue : null;
  }

  if (fieldType === 'date') {
    return typeof defaultValue === 'string' && defaultValue
      ? defaultValue
      : null;
  }

  if (fieldType === 'select') {
    return typeof defaultValue === 'string' && defaultValue
      ? defaultValue
      : null;
  }

  if (isEntityType(fieldType)) {
    return typeof defaultValue === 'number' ? defaultValue : null;
  }

  return null;
};

/** Parse a trimmed string into a finite number, or return undefined. */
const parseFinite = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
};

const buildValidationJson = (editing: EditingState): Validation | null => {
  const v: Validation = {};

  if (isTextLike(editing.fieldType)) {
    const regex = editing.validationRegex.trim();
    if (regex) v.regex = regex;
    v.minLength = parseFinite(editing.validationMinLength);
    v.maxLength = parseFinite(editing.validationMaxLength);
  }

  if (editing.fieldType === 'number') {
    v.min = parseFinite(editing.validationMin);
    v.max = parseFinite(editing.validationMax);
  }

  // Strip undefined keys and return null if empty
  const entries = Object.entries(v).filter(([, val]) => val !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

export const buildPayload = (editing: EditingState) => {
  const options =
    editing.fieldType === 'select'
      ? editing.optionsText
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
      : undefined;

  return {
    entityType: 'flight' as const,
    key: editing.key.trim(),
    label: editing.label.trim(),
    description: editing.description.trim() || null,
    fieldType: editing.fieldType,
    required: editing.required,
    active: editing.active,
    order: editing.order,
    options,
    defaultValue: getDefaultValue(editing),
    validationJson: buildValidationJson(editing),
  };
};

export type PayloadValidationError = { message: string };

export const validatePayload = (
  editing: EditingState,
  payload: ReturnType<typeof buildPayload>,
): PayloadValidationError | null => {
  if (!payload.key || !payload.label) {
    return { message: 'Key and label are required' };
  }

  const { validationJson } = payload;
  if (validationJson && typeof validationJson === 'object') {
    const v = validationJson as Validation;
    if (
      typeof v.min === 'number' &&
      typeof v.max === 'number' &&
      v.min > v.max
    ) {
      return { message: 'Min value cannot be greater than max value' };
    }
    if (
      typeof v.minLength === 'number' &&
      typeof v.maxLength === 'number' &&
      v.minLength > v.maxLength
    ) {
      return { message: 'Min length cannot be greater than max length' };
    }
  }

  if (
    editing.fieldType === 'select' &&
    (!payload.options || payload.options.length === 0)
  ) {
    return { message: 'Select fields require at least one option' };
  }

  if (
    editing.fieldType === 'select' &&
    payload.defaultValue != null &&
    typeof payload.defaultValue === 'string' &&
    payload.options &&
    !payload.options.includes(payload.defaultValue)
  ) {
    return { message: 'Default option must match one of the listed options' };
  }

  return null;
};
