import { db } from '@test/db';
import { generateId } from 'lucia';

import { hashArgon2 } from '$lib/server/utils/hash';

export interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
}

export const usersFactory = {
  async create(
    overrides: Partial<Omit<User, 'id'>> = {},
  ): Promise<{ user: User }> {
    const plainPassword = overrides.password || 'testPassword123';

    const user: User = {
      id: generateId(15),
      username: `user_${generateId(8)}`,
      password: plainPassword,
      displayName: overrides.displayName || 'Test User',
      ...overrides,
    };

    await db
      .insertInto('user')
      .values({
        id: user.id,
        username: user.username,
        password: await hashArgon2(plainPassword),
        displayName: user.displayName,
        roleId: 'role-administrator',
        isOwner: false,
      })
      .execute();

    return { user };
  },
};
