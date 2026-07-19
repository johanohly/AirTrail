import { describe, expect, it } from 'vitest';

import type { EditingState } from './types';
import { createBlankEditing, getDefaultValue } from './helpers';

const multiSelectEditing = (defaultValue: unknown): EditingState => ({
  ...createBlankEditing(0),
  fieldType: 'multi-select',
  defaultValue,
});

describe('getDefaultValue', () => {
  it('normalizes an empty multi-select default to null', () => {
    expect(getDefaultValue(multiSelectEditing([]))).toBeNull();
  });

  it('keeps selected multi-select defaults', () => {
    expect(
      getDefaultValue(multiSelectEditing(['Vegetarian', 'Gluten-free'])),
    ).toEqual(['Vegetarian', 'Gluten-free']);
  });
});
