import { describe, expect, it } from 'vitest';

import type { CustomFieldDefinition } from '$lib/utils/custom-fields';

import { validateCustomFields } from './validate-custom-fields';

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

describe('validateCustomFields', () => {
  it('accepts multi-select values from the configured options', () => {
    expect(
      validateCustomFields([definition()], {
        1: ['Vegetarian', 'Gluten-free'],
      }),
    ).toEqual({});
  });

  it('rejects unknown multi-select values', () => {
    expect(validateCustomFields([definition()], { 1: ['Kosher'] })).toEqual({
      1: 'Must use only the available options',
    });
  });

  it('treats an empty multi-select as missing when required', () => {
    expect(validateCustomFields([definition()], { 1: [] })).toEqual({
      1: 'Meal preferences is required',
    });
  });
});
