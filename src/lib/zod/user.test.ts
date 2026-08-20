import { describe, expect, it } from 'vitest';

import { updatePreferencesSchema } from './user';

describe('updatePreferencesSchema', () => {
  it('leaves omitted preferences out of the update', () => {
    expect(updatePreferencesSchema.parse({ dateFormat: 'iso' })).toEqual({
      dateFormat: 'iso',
    });
    expect(updatePreferencesSchema.parse({})).toEqual({});
  });
});
