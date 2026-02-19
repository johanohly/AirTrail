type Definition = {
  id: number;
  label: string;
  fieldType: string;
  required: boolean;
  options: unknown;
  validationJson: unknown;
};

type Validation = {
  regex?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
};

const TEXT_LIKE = new Set(['text', 'textarea']);

const parseValidation = (raw: unknown): Validation | null => {
  if (!raw || typeof raw !== 'object') return null;
  return raw as Validation;
};

const getOptions = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string')
    : [];

/**
 * Validate custom field values against their definitions.
 * Returns a map of fieldId → error message. Empty map means valid.
 */
export const validateCustomFields = (
  definitions: Definition[],
  values: Record<number, unknown>,
): Record<number, string> => {
  const errors: Record<number, string> = {};

  for (const def of definitions) {
    const value = values[def.id];
    const isEmpty = value === undefined || value === null || value === '';

    // Required check
    if (def.required && isEmpty) {
      errors[def.id] = `${def.label} is required`;
      continue;
    }

    // Skip further validation if empty and not required
    if (isEmpty) continue;

    // Type checks
    if (TEXT_LIKE.has(def.fieldType) && typeof value !== 'string') {
      errors[def.id] = 'Must be text';
      continue;
    }

    if (def.fieldType === 'number' && typeof value !== 'number') {
      errors[def.id] = 'Must be a number';
      continue;
    }

    if (def.fieldType === 'boolean' && typeof value !== 'boolean') {
      errors[def.id] = 'Must be true or false';
      continue;
    }

    if (def.fieldType === 'date' && typeof value !== 'string') {
      errors[def.id] = 'Must be a date';
      continue;
    }

    if (def.fieldType === 'select') {
      if (typeof value !== 'string') {
        errors[def.id] = 'Must select an option';
        continue;
      }
      const options = getOptions(def.options);
      if (!options.includes(value)) {
        errors[def.id] = 'Must be one of the available options';
        continue;
      }
    }

    // Validation rules
    const validation = parseValidation(def.validationJson);
    if (!validation) continue;

    if (TEXT_LIKE.has(def.fieldType) && typeof value === 'string') {
      if (validation.regex) {
        try {
          const re = new RegExp(validation.regex);
          if (!re.test(value)) {
            errors[def.id] = 'Does not match the required pattern';
            continue;
          }
        } catch {
          // Invalid regex in definition — skip check
        }
      }

      if (
        typeof validation.minLength === 'number' &&
        value.length < validation.minLength
      ) {
        errors[def.id] = `Must be at least ${validation.minLength} characters`;
        continue;
      }

      if (
        typeof validation.maxLength === 'number' &&
        value.length > validation.maxLength
      ) {
        errors[def.id] = `Must be at most ${validation.maxLength} characters`;
        continue;
      }
    }

    if (def.fieldType === 'number' && typeof value === 'number') {
      if (typeof validation.min === 'number' && value < validation.min) {
        errors[def.id] = `Must be at least ${validation.min}`;
        continue;
      }

      if (typeof validation.max === 'number' && value > validation.max) {
        errors[def.id] = `Must be at most ${validation.max}`;
        continue;
      }
    }
  }

  return errors;
};
