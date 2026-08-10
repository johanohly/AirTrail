export const CUSTOM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'select',
  'multi-select',
  'airport',
  'airline',
  'aircraft',
] as const;

export type FieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_ENTITY_TYPES = [
  'flight',
  'flight_passenger',
] as const;

export type EntityType = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number];

export type CustomFieldValidation = {
  regex?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  boolean: 'Boolean',
  date: 'Date',
  select: 'Select',
  'multi-select': 'Multi-select',
  airport: 'Airport',
  airline: 'Airline',
  aircraft: 'Aircraft',
};

/** Shape returned by `listDefinitions` query — shared across all custom field UI. */
export type CustomFieldDefinition = {
  id: number;
  entityType: EntityType;
  key: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  required: boolean;
  active: boolean;
  order: number;
  options: unknown;
  defaultValue: unknown;
  validationJson: unknown;
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  flight: 'Flight fields',
  flight_passenger: 'Passenger fields',
};

export const isTextLike = (fieldType: string) =>
  fieldType === 'text' || fieldType === 'textarea';

export const isEntityType = (fieldType: string) =>
  fieldType === 'airport' ||
  fieldType === 'airline' ||
  fieldType === 'aircraft';

/** Extract a string[] from an unknown options value (typically JSON from DB). */
export const normalizeOptions = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === 'string')
    : [];

type ValueDefinition = Pick<
  CustomFieldDefinition,
  'label' | 'fieldType' | 'required' | 'options' | 'validationJson'
>;

type DefinitionInput = Pick<
  CustomFieldDefinition,
  'label' | 'fieldType' | 'required'
> & {
  options?: unknown;
  defaultValue?: unknown;
  validationJson?: unknown;
};

export const isCustomFieldValueEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const parseValidation = (value: unknown): CustomFieldValidation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as CustomFieldValidation;
};

const validateValueType = (
  definition: ValueDefinition,
  value: unknown,
): string | null => {
  if (isTextLike(definition.fieldType) && typeof value !== 'string') {
    return 'Must be text';
  }
  if (
    definition.fieldType === 'number' &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    return 'Must be a number';
  }
  if (definition.fieldType === 'boolean' && typeof value !== 'boolean') {
    return 'Must be true or false';
  }
  if (definition.fieldType === 'date') {
    if (typeof value !== 'string') return 'Must be a date';

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return 'Must be a date';

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
      31,
      leapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    if (
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > (daysInMonth[month - 1] ?? 0)
    ) {
      return 'Must be a date';
    }
  }
  if (definition.fieldType === 'select') {
    if (typeof value !== 'string') return 'Must select an option';
    if (!normalizeOptions(definition.options).includes(value)) {
      return 'Must be one of the available options';
    }
  }
  if (definition.fieldType === 'multi-select') {
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== 'string')
    ) {
      return 'Must select one or more options';
    }
    const options = normalizeOptions(definition.options);
    if (value.some((item) => !options.includes(item))) {
      return 'Must use only the available options';
    }
  }
  if (
    isEntityType(definition.fieldType) &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    return 'Must select a valid option';
  }
  return null;
};

const validateRules = (
  definition: ValueDefinition,
  value: unknown,
): string | null => {
  const validation = parseValidation(definition.validationJson);
  if (!validation) return null;

  if (isTextLike(definition.fieldType) && typeof value === 'string') {
    if (validation.regex) {
      try {
        if (!new RegExp(validation.regex).test(value)) {
          return 'Does not match the required pattern';
        }
      } catch {
        return 'Uses an invalid validation pattern';
      }
    }
    if (
      typeof validation.minLength === 'number' &&
      value.length < validation.minLength
    ) {
      return `Must be at least ${validation.minLength} characters`;
    }
    if (
      typeof validation.maxLength === 'number' &&
      value.length > validation.maxLength
    ) {
      return `Must be at most ${validation.maxLength} characters`;
    }
  }

  if (definition.fieldType === 'number' && typeof value === 'number') {
    if (typeof validation.min === 'number' && value < validation.min) {
      return `Must be at least ${validation.min}`;
    }
    if (typeof validation.max === 'number' && value > validation.max) {
      return `Must be at most ${validation.max}`;
    }
  }

  return null;
};

export const validateCustomFieldValue = (
  definition: ValueDefinition,
  value: unknown,
): string | null => {
  if (isCustomFieldValueEmpty(value)) {
    return definition.required ? `${definition.label} is required` : null;
  }

  return (
    validateValueType(definition, value) ?? validateRules(definition, value)
  );
};

export const validateCustomFieldDefinition = (
  definition: DefinitionInput,
): string | null => {
  const options = normalizeOptions(definition.options);
  if (
    (definition.fieldType === 'select' ||
      definition.fieldType === 'multi-select') &&
    options.length === 0
  ) {
    return 'Select fields require at least one option';
  }

  const validation = parseValidation(definition.validationJson);
  if (validation) {
    if (isTextLike(definition.fieldType) && validation.regex) {
      try {
        new RegExp(validation.regex);
      } catch {
        return 'Regex pattern is invalid';
      }
    }
    if (
      typeof validation.minLength === 'number' &&
      typeof validation.maxLength === 'number' &&
      validation.minLength > validation.maxLength
    ) {
      return 'Min length cannot be greater than max length';
    }
    if (
      typeof validation.min === 'number' &&
      typeof validation.max === 'number' &&
      validation.min > validation.max
    ) {
      return 'Min value cannot be greater than max value';
    }
  }

  if (definition.defaultValue == null) return null;
  if (isCustomFieldValueEmpty(definition.defaultValue)) {
    return 'Default value cannot be empty';
  }

  const defaultError = validateCustomFieldValue(
    {
      label: definition.label,
      fieldType: definition.fieldType,
      required: false,
      options: definition.options,
      validationJson: definition.validationJson,
    },
    definition.defaultValue,
  );
  return defaultError ? `Default value: ${defaultError}` : null;
};
