import { hash, type Options, verify } from '@node-rs/argon2';

const hashingOptions: Options = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export const generateHash = async (string: string): Promise<string> => {
  return hash(normalize(string), hashingOptions);
};

export const verifyHash = async (
  hashedString: string,
  string: string,
): Promise<boolean> => {
  return await verify(hashedString, normalize(string), hashingOptions);
};

const normalize = (string: string): string => {
  return string.normalize('NFKC');
};
