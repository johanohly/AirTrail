import { hash, type Options, verify } from '@node-rs/argon2';

const hashingOptions: Options = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export const hashPassword = async (password: string): Promise<string> => {
  return hash(normalizePassword(password), hashingOptions);
};

export const verifyPassword = async (
  hashedPassword: string,
  password: string,
): Promise<boolean> => {
  return await verify(
    hashedPassword,
    normalizePassword(password),
    hashingOptions,
  );
};

const normalizePassword = (password: string): string => {
  return password.normalize('NFKC');
};
