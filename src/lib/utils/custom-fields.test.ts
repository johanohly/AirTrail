import { describe, expect, it } from 'vitest';

import type { CustomFieldDefinition } from './custom-fields';
import {
  validateCustomFieldDefinition,
  validateCustomFieldValue,
} from './custom-fields';

const definition = (
  overrides: Partial<CustomFieldDefinition> = {},
): CustomFieldDefinition => ({
  id: 1,
  entityType: 'flight_passenger',
  key: 'meal_preferences',
  label: 'Meal preferences',
  description: null,
  fieldType: 'multi-select',
  required: true,
  active: true,
  order: 0,
  options: ['Vegetarian', 'Gluten-free'],
  defaultValue: null,
  validationJson: null,
  ...overrides,
});

describe('validateCustomFieldValue', () => {
  it('uses the same multi-select policy for every caller', () => {
    const field = definition();

    expect(validateCustomFieldValue(field, ['Vegetarian'])).toBeNull();
    expect(validateCustomFieldValue(field, ['Kosher'])).toBe(
      'Must use only the available options',
    );
    expect(validateCustomFieldValue(field, [])).toBe(
      'Meal preferences is required',
    );
  });

  it('applies text and number validation rules', () => {
    expect(
      validateCustomFieldValue(
        definition({
          fieldType: 'text',
          validationJson: { minLength: 3, regex: '^[A-Z]+$' },
        }),
        'ab',
      ),
    ).toBe('Does not match the required pattern');
    expect(
      validateCustomFieldValue(
        definition({
          fieldType: 'number',
          validationJson: { min: 2 },
        }),
        1,
      ),
    ).toBe('Must be at least 2');
  });
});

describe('validateCustomFieldDefinition', () => {
  it('validates defaults with the shared value policy', () => {
    expect(
      validateCustomFieldDefinition(definition({ defaultValue: ['Kosher'] })),
    ).toBe('Default value: Must use only the available options');
  });

  it('rejects invalid ranges and regex patterns', () => {
    expect(
      validateCustomFieldDefinition(
        definition({
          fieldType: 'number',
          validationJson: { min: 10, max: 5 },
        }),
      ),
    ).toBe('Min value cannot be greater than max value');
    expect(
      validateCustomFieldDefinition(
        definition({ fieldType: 'text', validationJson: { regex: '[' } }),
      ),
    ).toBe('Regex pattern is invalid');
  });
});
