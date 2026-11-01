import { describe, expect, it } from 'vitest';

import {
  getCustomFieldEntriesToPersist,
  resolveFlightCustomFieldEntries,
} from './custom-fields';

import type { CustomFieldDefinition } from '$lib/utils/custom-fields';

describe('custom-field persistence planning', () => {
  it('keeps defaults in the write plan', () => {
    expect(
      getCustomFieldEntriesToPersist(
        new Map(),
        new Map([[1, 'default value']]),
        new Map(),
      ),
    ).toEqual(new Map([[1, 'default value']]));
  });

  it('drops no-op writes and keeps real updates', () => {
    expect(
      getCustomFieldEntriesToPersist(
        new Map<number, unknown>([
          [1, 'same'],
          [2, 'remove me'],
        ]),
        new Map(),
        new Map<number, unknown | null>([
          [1, 'same'],
          [2, null],
          [3, 'new'],
        ]),
      ),
    ).toEqual(
      new Map<number, unknown | null>([
        [2, null],
        [3, 'new'],
      ]),
    );
  });
});

describe('resolveFlightCustomFieldEntries', () => {
  const definitions: ReadonlyArray<
    Pick<CustomFieldDefinition, 'id' | 'fieldType'>
  > = [
    { id: 1, fieldType: 'text' },
    { id: 2, fieldType: 'airport' },
    { id: 3, fieldType: 'number' },
  ];

  const noNames = {
    airport: new Map<number, string>(),
    airline: new Map<number, string>(),
    aircraft: new Map<number, string>(),
  };

  it('drops rows without a definition and empty values', () => {
    const entries = resolveFlightCustomFieldEntries(
      definitions,
      [
        { entityId: '10', fieldId: 99, value: 'orphan' },
        { entityId: '10', fieldId: 1, value: '' },
        { entityId: '10', fieldId: 1, value: 'kept' },
      ],
      noNames,
    );
    expect([...entries.keys()]).toEqual(['10']);
    expect(entries.get('10')).toEqual([
      { fieldId: 1, value: 'kept', valueLabel: null },
    ]);
  });

  it('orders entries by definition, not row order', () => {
    const entries = resolveFlightCustomFieldEntries(
      definitions,
      [
        { entityId: '10', fieldId: 3, value: 2 },
        { entityId: '10', fieldId: 1, value: 'b' },
      ],
      noNames,
    );
    expect(entries.get('10')?.map((entry) => entry.fieldId)).toEqual([1, 3]);
  });

  it('groups entries per entity', () => {
    const entries = resolveFlightCustomFieldEntries(
      definitions,
      [
        { entityId: '10', fieldId: 1, value: 'a' },
        { entityId: '20', fieldId: 1, value: 'b' },
      ],
      noNames,
    );
    expect([...entries.keys()]).toEqual(['10', '20']);
  });

  it('resolves entity labels and leaves null for missing or non-numeric', () => {
    const entries = resolveFlightCustomFieldEntries(
      definitions,
      [
        { entityId: '10', fieldId: 2, value: 5 },
        { entityId: '20', fieldId: 2, value: 6 },
        { entityId: '30', fieldId: 2, value: 'LHR' },
      ],
      {
        airport: new Map([[5, 'London Heathrow']]),
        airline: new Map<number, string>(),
        aircraft: new Map<number, string>(),
      },
    );
    expect(entries.get('10')?.[0]?.valueLabel).toBe('London Heathrow');
    expect(entries.get('20')?.[0]?.valueLabel).toBeNull();
    expect(entries.get('30')?.[0]?.valueLabel).toBeNull();
  });
});
