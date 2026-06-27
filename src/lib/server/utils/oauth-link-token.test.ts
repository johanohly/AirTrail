import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteChains,
  insertChain,
  mockDb,
  mockGenerateString,
  mockHashSha256,
  mockTrx,
  selectResults,
  transactionExecute,
  updateChain,
} = vi.hoisted(() => {
  const deleteChains: any[] = [];
  const selectResults: any[] = [];

  const insertChain = {
    values: vi.fn().mockReturnThis(),
    execute: vi.fn(async () => undefined),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn(async () => undefined),
  };
  const createDeleteChain = () => {
    const chain = {
      where: vi.fn().mockReturnThis(),
      execute: vi.fn(async () => undefined),
    };
    deleteChains.push(chain);
    return chain;
  };
  const createSelectChain = () => ({
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    forUpdate: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn(async () => selectResults.shift()),
  });
  const mockTrx = {
    deleteFrom: vi.fn(() => createDeleteChain()),
    insertInto: vi.fn(() => insertChain),
    selectFrom: vi.fn(() => createSelectChain()),
    updateTable: vi.fn(() => updateChain),
  };
  const transactionExecute = vi.fn(async (callback) => callback(mockTrx));
  const mockDb = {
    deleteFrom: vi.fn(() => createDeleteChain()),
    insertInto: vi.fn(() => insertChain),
    transaction: vi.fn(() => ({ execute: transactionExecute })),
  };

  return {
    deleteChains,
    insertChain,
    mockDb,
    mockGenerateString: vi.fn(),
    mockHashSha256: vi.fn((value: string) => `hashed:${value}`),
    mockTrx,
    selectResults,
    transactionExecute,
    updateChain,
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
  createOAuthLinkToken,
  linkOAuthAccount,
  linkOAuthAccountWithToken,
} from './oauth-link-token';

describe('oauth link tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
    vi.clearAllMocks();
    deleteChains.length = 0;
    selectResults.length = 0;
    mockGenerateString
      .mockReset()
      .mockReturnValueOnce('plain-token')
      .mockReturnValueOnce('row-id');
    mockHashSha256.mockClear();
    insertChain.values.mockClear();
    insertChain.execute.mockClear();
    updateChain.set.mockClear();
    updateChain.where.mockClear();
    updateChain.execute.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a hashed expiring token and replaces prior tokens for the user', async () => {
    selectResults.push({ id: 'user-1' });

    const token = await createOAuthLinkToken('user-1', 'oauth-sub-1');

    expect(token).toBe('plain-token');
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockTrx.selectFrom).toHaveBeenCalledWith('user');
    expect(mockTrx.deleteFrom).toHaveBeenNthCalledWith(1, 'oauthLinkToken');
    expect(mockTrx.deleteFrom).toHaveBeenNthCalledWith(2, 'oauthLinkToken');
    expect(deleteChains[1]!.where).toHaveBeenCalledWith(
      'userId',
      '=',
      'user-1',
    );
    expect(mockHashSha256).toHaveBeenCalledWith('plain-token');
    expect(mockTrx.insertInto).toHaveBeenCalledWith('oauthLinkToken');
    expect(insertChain.values).toHaveBeenCalledWith({
      id: 'row-id',
      token: 'hashed:plain-token',
      userId: 'user-1',
      oauthSub: 'oauth-sub-1',
      expiresAt: new Date('2026-06-25T12:10:00.000Z'),
    });
  });

  it('links with a token inside one transaction before deleting it', async () => {
    selectResults.push(
      {
        id: 'token-row-id',
        token: 'hashed:plain-token',
        userId: 'user-1',
        oauthSub: 'oauth-sub-1',
        expiresAt: new Date('2026-06-25T12:10:00.000Z'),
        createdAt: new Date('2026-06-25T12:00:00.000Z'),
      },
      { id: 'user-1', oauthId: null },
      undefined,
    );

    const result = await linkOAuthAccountWithToken('user-1', 'plain-token');

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(transactionExecute).toHaveBeenCalled();
    expect(mockTrx.selectFrom).toHaveBeenNthCalledWith(1, 'oauthLinkToken');
    expect(mockTrx.selectFrom).toHaveBeenNthCalledWith(2, 'user');
    expect(mockTrx.selectFrom).toHaveBeenNthCalledWith(3, 'user');
    expect(updateChain.set).toHaveBeenCalledWith({ oauthId: 'oauth-sub-1' });
    expect(mockTrx.deleteFrom).toHaveBeenCalledWith('oauthLinkToken');
    expect(deleteChains.at(-1)!.where).toHaveBeenCalledWith(
      'id',
      '=',
      'token-row-id',
    );
  });

  it('directly links an OAuth subject inside a transaction', async () => {
    selectResults.push({ id: 'user-1', oauthId: null }, undefined);

    const result = await linkOAuthAccount('user-1', 'oauth-sub-1');

    expect(result).toEqual({ success: true });
    expect(mockTrx.selectFrom).toHaveBeenNthCalledWith(1, 'user');
    expect(mockTrx.selectFrom).toHaveBeenNthCalledWith(2, 'user');
    expect(updateChain.set).toHaveBeenCalledWith({ oauthId: 'oauth-sub-1' });
  });

  it('does not delete the token when the authenticated user does not match', async () => {
    selectResults.push(undefined);

    const result = await linkOAuthAccountWithToken('user-2', 'plain-token');

    expect(result).toEqual({ success: false, reason: 'invalid_token' });
    expect(mockTrx.updateTable).not.toHaveBeenCalled();
    expect(mockTrx.deleteFrom).not.toHaveBeenCalled();
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
