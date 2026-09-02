import { describe, expect, it } from 'vitest';

import { referencedBackupUserIds } from './backup';

describe('backup user scoping', () => {
  it('includes only users referenced by exported flights', () => {
    expect(
      referencedBackupUserIds([
        {
          passengers: [
            { userId: 'user-one' },
            { userId: null },
            { userId: 'user-two' },
          ],
        },
        { passengers: [{ userId: 'user-one' }] },
      ]),
    ).toEqual(['user-one', 'user-two']);
  });
});
