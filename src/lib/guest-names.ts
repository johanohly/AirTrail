export type GuestNameCount = Readonly<{
  name: string;
  count: number;
}>;

export const guestNameIdentity = (name: string) => name.trim().toLowerCase();

const compareGuestNames = (nameA: string, nameB: string) =>
  nameA < nameB ? -1 : nameA > nameB ? 1 : 0;

export const rankGuestNames = (
  rows: ReadonlyArray<GuestNameCount>,
): GuestNameCount[] => {
  const byIdentity = new Map<
    string,
    { count: number; spellings: Map<string, number> }
  >();

  for (const row of rows) {
    const name = row.name.trim();
    const identity = guestNameIdentity(name);
    if (!identity) continue;

    const aggregate = byIdentity.get(identity) ?? {
      count: 0,
      spellings: new Map<string, number>(),
    };
    aggregate.count += row.count;
    aggregate.spellings.set(
      name,
      (aggregate.spellings.get(name) ?? 0) + row.count,
    );
    byIdentity.set(identity, aggregate);
  }

  return [...byIdentity.values()]
    .flatMap(({ count, spellings }) => {
      const preferredName = [...spellings.entries()].sort(
        ([nameA, countA], [nameB, countB]) =>
          countB - countA || compareGuestNames(nameA, nameB),
      )[0]?.[0];
      return preferredName ? [{ name: preferredName, count }] : [];
    })
    .sort((a, b) => b.count - a.count || compareGuestNames(a.name, b.name));
};

export const canUseGuestName = ({
  name,
  knownGuests,
  excludedNames,
}: {
  name: string;
  knownGuests: ReadonlyArray<GuestNameCount>;
  excludedNames: ReadonlyArray<string>;
}) => {
  const identity = guestNameIdentity(name);
  if (!identity) return false;

  return (
    !knownGuests.some((guest) => guestNameIdentity(guest.name) === identity) &&
    !excludedNames.some((excluded) => guestNameIdentity(excluded) === identity)
  );
};

export const hasDuplicateGuestNames = (names: ReadonlyArray<string | null>) => {
  const seen = new Set<string>();
  for (const name of names) {
    if (name === null) continue;
    const identity = guestNameIdentity(name);
    if (!identity) continue;
    if (seen.has(identity)) return true;
    seen.add(identity);
  }
  return false;
};
