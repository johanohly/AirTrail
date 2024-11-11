export type DeepBoolean<T, B extends boolean> = T extends object
  ? { [K in keyof T]: DeepBoolean<T[K], B> }
  : B;

export const deepSetAllValues = <T extends object, B extends boolean>(
  obj: T,
  value: B,
): DeepBoolean<T, B> => {
  return Object.keys(obj).reduce(
    (acc, key) => {
      const val = obj[key as keyof T];
      acc[key as keyof T] =
        typeof val === 'object' && val !== null
          ? deepSetAllValues(val, value)
          : value;
      return acc;
    },
    {} as DeepBoolean<T, B>,
  );
};
