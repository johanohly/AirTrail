import { describe, expect, it } from 'vitest';

import { getCustomFieldEntriesToPersist } from './custom-fields';

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
