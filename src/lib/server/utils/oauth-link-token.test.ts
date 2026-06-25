import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteChains,
  insertChain,
  mockDb,
  mockGenerateString,
  mockHashSha256,
} = vi.hoisted(() => {
  const deleteChains: any[] = [];
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    execute: vi.fn(async () => undefined),
  };
  const createDeleteChain = () => {
    const chain = {
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      execute: vi.fn(async () => undefined),
      executeTakeFirst: vi.fn(async () => undefined),
    };
    deleteChains.push(chain);
    return chain;
  };
  const mockDb = {
    deleteFrom: vi.fn(() => createDeleteChain()),
    insertInto: vi.fn(() => insertChain),
  };

  return {
    deleteChains,
    insertChain,
    mockDb,
    mockGenerateString: vi.fn(),
    mockHashSha256: vi.fn((value: string) => `hashed:${value}`),
  };
});

vi.mock('$lib/db', () => ({
  db: mockDb,
}));

vi.mock('$lib/server/utils/hash', () => ({
  hashSha256: mockHashSha256,
}));

vi.mock('$lib/server/utils/random', () => ({
  generateString: mockGenerateString,
}));

import {
  cleanupExpiredOAuthLinkTokens,
  consumeOAuthLinkToken,
  createOAuthLinkToken,
} from './oauth-link-token';

describe('oauth link tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
    vi.clearAllMocks();
    deleteChains.length = 0;
    mockGenerateString
      .mockReset()
      .mockReturnValueOnce('plain-token')
      .mockReturnValueOnce('row-id');
    mockHashSha256.mockClear();
    insertChain.values.mockClear();
    insertChain.execute.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a hashed expiring token and replaces prior tokens for the user', async () => {
    const token = await createOAuthLinkToken('user-1', 'oauth-sub-1');

    expect(token).toBe('plain-token');
    expect(mockDb.deleteFrom).toHaveBeenNthCalledWith(1, 'oauthLinkToken');
    expect(mockDb.deleteFrom).toHaveBeenNthCalledWith(2, 'oauthLinkToken');
    expect(deleteChains[1]!.where).toHaveBeenCalledWith(
      'userId',
      '=',
      'user-1',
    );
    expect(mockHashSha256).toHaveBeenCalledWith('plain-token');
    expect(mockDb.insertInto).toHaveBeenCalledWith('oauthLinkToken');
    expect(insertChain.values).toHaveBeenCalledWith({
      id: 'row-id',
      token: 'hashed:plain-token',
      userId: 'user-1',
      oauthSub: 'oauth-sub-1',
      expiresAt: new Date('2026-06-25T12:10:00.000Z'),
    });
  });

  it('consumes a token atomically and only when it is not expired', async () => {
    const expected = {
      id: 'row-id',
      token: 'hashed:plain-token',
      userId: 'user-1',
      oauthSub: 'oauth-sub-1',
      expiresAt: new Date('2026-06-25T12:10:00.000Z'),
      createdAt: new Date('2026-06-25T12:00:00.000Z'),
    };
    mockDb.deleteFrom.mockImplementationOnce(() => {
      const chain = {
        where: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        execute: vi.fn(async () => undefined),
        executeTakeFirst: vi.fn(async () => expected),
      };
      deleteChains.push(chain);
      return chain;
    });

    const token = await consumeOAuthLinkToken('plain-token');

    expect(token).toBe(expected);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith('oauthLinkToken');
    const chain = deleteChains.at(-1)!;
    expect(chain.where).toHaveBeenCalledWith(
      'token',
      '=',
      'hashed:plain-token',
    );
    expect(chain.where).toHaveBeenCalledWith(
      'expiresAt',
      '>',
      new Date('2026-06-25T12:00:00.000Z'),
    );
    expect(chain.returningAll).toHaveBeenCalled();
    expect(chain.executeTakeFirst).toHaveBeenCalled();
  });

  it('cleans up expired tokens', async () => {
    await cleanupExpiredOAuthLinkTokens();

    expect(mockDb.deleteFrom).toHaveBeenCalledWith('oauthLinkToken');
    expect(deleteChains[0]!.where).toHaveBeenCalledWith(
      'expiresAt',
      '<=',
      new Date('2026-06-25T12:00:00.000Z'),
    );
    expect(deleteChains[0]!.execute).toHaveBeenCalled();
  });
});
