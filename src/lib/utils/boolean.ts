export type DeepBoolean<T, B extends boolean> = T extends object
  ? { [K in keyof T]: DeepBoolean<T[K], B> }
  : B;

export const deepSetAllValues = <T extends object, B extends boolean>(
  obj: T,
  value: B,
): DeepBoolean<T, B> => {
  const result = {} as { [K in keyof T]?: unknown };
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const item = obj[key];
    result[key] =
      typeof item === 'object' && item !== null
        ? deepSetAllValues(item, value)
        : value;
  }
  return result as DeepBoolean<T, B>;
};
