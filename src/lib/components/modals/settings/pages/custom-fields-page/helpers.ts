import type {
  DefinitionItem,
  EditingState,
  FieldType,
  Validation,
} from './types';

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

export const normalizeOptions = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === 'string')
    : [];

export const toKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

export const createBlankEditing = (order: number): EditingState => ({
  key: '',
  label: '',
  description: '',
  fieldType: 'text',
  required: false,
  active: true,
  order,
  optionsText: '',
  defaultText: '',
  defaultNumber: '',
  defaultBoolean: false,
  defaultDate: '',
  defaultSelect: '',
  defaultEntity: null,
  validationRegex: '',
  validationMin: '',
  validationMax: '',
  validationMinLength: '',
  validationMaxLength: '',
});

export const itemToEditing = (item: DefinitionItem): EditingState => {
  const validation = parseValidation(item.validationJson);
  const options = normalizeOptions(item.options);

  return {
    id: item.id,
    key: item.key,
    label: item.label,
    description: item.description ?? '',
    fieldType: item.fieldType,
    required: item.required,
    active: item.active,
    order: item.order,
    optionsText: options.join('\n'),
    defaultText:
      typeof item.defaultValue === 'string' &&
      (item.fieldType === 'text' || item.fieldType === 'textarea')
        ? item.defaultValue
        : '',
    defaultNumber:
      typeof item.defaultValue === 'number' && item.fieldType === 'number'
        ? String(item.defaultValue)
        : '',
    defaultBoolean:
      typeof item.defaultValue === 'boolean' && item.fieldType === 'boolean'
        ? item.defaultValue
        : false,
    defaultDate:
      typeof item.defaultValue === 'string' && item.fieldType === 'date'
        ? item.defaultValue
        : '',
    defaultSelect:
      typeof item.defaultValue === 'string' &&
      item.fieldType === 'select' &&
      options.includes(item.defaultValue)
        ? item.defaultValue
        : '',
    defaultEntity:
      typeof item.defaultValue === 'number' && isEntityType(item.fieldType)
        ? item.defaultValue
        : null,
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

export const isTextLike = (fieldType: string) =>
  fieldType === 'text' || fieldType === 'textarea';

export const isEntityType = (fieldType: string) =>
  fieldType === 'airport' ||
  fieldType === 'airline' ||
  fieldType === 'aircraft';

/** Read the current default as a raw value for use in CustomFieldInput. */
export const getPreviewValue = (editing: EditingState): unknown => {
  if (isTextLike(editing.fieldType)) return editing.defaultText || null;
  if (editing.fieldType === 'number') {
    if (!editing.defaultNumber) return null;
    const n = Number(editing.defaultNumber);
    return Number.isNaN(n) ? null : n;
  }
  if (editing.fieldType === 'boolean') return editing.defaultBoolean;
  if (editing.fieldType === 'date') return editing.defaultDate || null;
  if (editing.fieldType === 'select') return editing.defaultSelect || null;
  if (isEntityType(editing.fieldType)) return editing.defaultEntity;
  return null;
};

/** Write a raw value from CustomFieldInput back into the editing state. */
export const setPreviewValue = (
  editing: EditingState,
  value: unknown,
): void => {
  if (isTextLike(editing.fieldType)) {
    editing.defaultText = typeof value === 'string' ? value : '';
  } else if (editing.fieldType === 'number') {
    editing.defaultNumber = typeof value === 'number' ? String(value) : '';
  } else if (editing.fieldType === 'boolean') {
    editing.defaultBoolean = Boolean(value);
  } else if (editing.fieldType === 'date') {
    editing.defaultDate = typeof value === 'string' ? value : '';
  } else if (editing.fieldType === 'select') {
    editing.defaultSelect = typeof value === 'string' ? value : '';
  } else if (isEntityType(editing.fieldType)) {
    editing.defaultEntity = typeof value === 'number' ? value : null;
  }
};

export const getDefaultValue = (editing: EditingState): unknown => {
  if (isTextLike(editing.fieldType)) {
    return editing.defaultText.trim() || null;
  }

  if (editing.fieldType === 'number') {
    if (!editing.defaultNumber.trim()) return null;
    const parsed = Number(editing.defaultNumber);
    if (Number.isNaN(parsed)) {
      throw new Error('Default value must be a valid number');
    }
    return parsed;
  }

  if (editing.fieldType === 'boolean') {
    return editing.defaultBoolean;
  }

  if (editing.fieldType === 'date') {
    return editing.defaultDate || null;
  }

  if (editing.fieldType === 'select') {
    return editing.defaultSelect || null;
  }

  if (isEntityType(editing.fieldType)) {
    return editing.defaultEntity;
  }

  return null;
};

export const buildPayload = (editing: EditingState) => {
  const defaultValue = getDefaultValue(editing);
  const validationJson: Validation = {};

  if (isTextLike(editing.fieldType)) {
    if (editing.validationRegex.trim()) {
      validationJson.regex = editing.validationRegex.trim();
    }
    if (editing.validationMinLength.trim()) {
      validationJson.minLength = Number(editing.validationMinLength);
    }
    if (editing.validationMaxLength.trim()) {
      validationJson.maxLength = Number(editing.validationMaxLength);
    }
  }

  if (editing.fieldType === 'number') {
    if (editing.validationMin.trim()) {
      validationJson.min = Number(editing.validationMin);
    }
    if (editing.validationMax.trim()) {
      validationJson.max = Number(editing.validationMax);
    }
  }

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
    defaultValue,
    validationJson: Object.keys(validationJson).length ? validationJson : null,
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
