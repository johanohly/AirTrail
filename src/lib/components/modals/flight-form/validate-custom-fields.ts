import {
  isEntityType,
  isTextLike,
  normalizeOptions,
  type CustomFieldDefinition,
} from '$lib/utils/custom-fields';

type Validation = {
  regex?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
};

type FieldDef = Pick<
  CustomFieldDefinition,
  'id' | 'label' | 'fieldType' | 'required' | 'options' | 'validationJson'
>;

const parseValidation = (raw: unknown): Validation | null => {
  if (!raw || typeof raw !== 'object') return null;
  return raw as Validation;
};

const checkType = (def: FieldDef, value: unknown): string | null => {
  if (isTextLike(def.fieldType) && typeof value !== 'string') {
    return 'Must be text';
  }
  if (def.fieldType === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'Must be a number';
    }
  }
  if (def.fieldType === 'boolean' && typeof value !== 'boolean') {
    return 'Must be true or false';
  }
  if (def.fieldType === 'date' && typeof value !== 'string') {
    return 'Must be a date';
  }
  if (def.fieldType === 'select') {
    if (typeof value !== 'string') return 'Must select an option';
    const options = normalizeOptions(def.options);
    if (!options.includes(value)) return 'Must be one of the available options';
  }
  if (isEntityType(def.fieldType) && typeof value !== 'number') {
    return 'Must select a valid option';
  }
  return null;
};

const checkTextRules = (
  value: string,
  validation: Validation,
): string | null => {
  if (validation.regex) {
    try {
      const re = new RegExp(validation.regex);
      if (!re.test(value)) return 'Does not match the required pattern';
    } catch {
      // Invalid regex in definition — skip check
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
  return null;
};

const checkNumberRules = (
  value: number,
  validation: Validation,
): string | null => {
  if (typeof validation.min === 'number' && value < validation.min) {
    return `Must be at least ${validation.min}`;
  }
  if (typeof validation.max === 'number' && value > validation.max) {
    return `Must be at most ${validation.max}`;
  }
  return null;
};

const checkValidationRules = (def: FieldDef, value: unknown): string | null => {
  const validation = parseValidation(def.validationJson);
  if (!validation) return null;

  if (isTextLike(def.fieldType) && typeof value === 'string') {
    return checkTextRules(value, validation);
  }
  if (def.fieldType === 'number' && typeof value === 'number') {
    return checkNumberRules(value, validation);
  }
  return null;
};

const validateField = (def: FieldDef, value: unknown): string | null => {
  const isEmpty = value === undefined || value === null || value === '';

  if (def.required && isEmpty) return `${def.label} is required`;
  if (isEmpty) return null;

  const typeError = checkType(def, value);
  if (typeError) return typeError;

  return checkValidationRules(def, value);
};

/**
 * Validate custom field values against their definitions.
 * Returns a map of fieldId → error message. Empty map means valid.
 */
export const validateCustomFields = (
  definitions: FieldDef[],
  values: Record<number, unknown>,
): Record<number, string> => {
  const errors: Record<number, string> = {};
  for (const def of definitions) {
    const error = validateField(def, values[def.id]);
    if (error) errors[def.id] = error;
  }
  return errors;
};
