type MatchCriteria<T> = {
  key: keyof T;
  exact?: boolean; // whether to prioritize exact matches or partial matches
};

export const sortAndFilterByMatch = <T>(
  items: T[],
  input: string,
  criteria: MatchCriteria<T>[],
  sortFn: (a: T, b: T) => number = () => 0,
  maxResults: number = 20,
): T[] => {
  const lowerInput = input.toLowerCase();

  return items
    .filter((item) =>
      criteria.some(({ key, exact }) => {
        const value = String(item[key]).toLowerCase();
        return exact ? value === lowerInput : value.includes(lowerInput);
      }),
    )
    .sort((a, b) => {
      for (const { key, exact } of criteria) {
        const aValue = String(a[key]).toLowerCase();
        const bValue = String(b[key]).toLowerCase();
        if (exact) {
          if (aValue === lowerInput && bValue !== lowerInput) return -1;
          if (aValue !== lowerInput && bValue === lowerInput) return 1;
        }
      }

      return sortFn(a, b);
    })
    .slice(0, maxResults);
};
