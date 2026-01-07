import { createHash } from 'node:crypto';

import { hash, type Options, verify } from '@node-rs/argon2';

const hashingOptions: Options = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export const hashArgon2 = async (string: string): Promise<string> => {
  return hash(normalize(string), hashingOptions);
};

export const verifyArgon2 = async (
  hashedString: string,
  string: string,
): Promise<boolean> => {
  return await verify(hashedString, normalize(string), hashingOptions);
};

export const hashSha256 = (string: string): string => {
  return createHash('sha256').update(normalize(string)).digest('base64');
};

const normalize = (string: string): string => {
  return string.normalize('NFKC');
};
