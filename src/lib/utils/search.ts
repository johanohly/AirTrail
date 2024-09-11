type MatchCriteria<T> = {
  key: keyof T;
  exact?: boolean; // whether to prioritize exact matches or partial matches
};

export const sortAndFilterByMatch = <T>(
  items: T[],
  input: string,
  criteria: MatchCriteria<T>[],
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

        const aMatches = exact
          ? aValue === lowerInput
          : aValue.includes(lowerInput);
        const bMatches = exact
          ? bValue === lowerInput
          : bValue.includes(lowerInput);

        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }

      return 0; // if all criteria are equal, maintain original order
    })
    .slice(0, maxResults);
};
