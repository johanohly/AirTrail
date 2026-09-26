import { describe, expect, it } from 'vitest';

import type { Permission } from '$lib/authorization/permissions';
import { createFlightListAccess } from './flight-list-access';

const access = (permissions: Permission[], readonly = false) =>
  createFlightListAccess({
    authorization: { isOwner: false, permissions },
    userId: 'actor',
    readonly,
  });

const ownFlight = { passengers: [{ userId: 'actor' }] };
const otherFlight = { passengers: [{ userId: 'other' }] };

describe('flight list access model', () => {
  it('applies own permissions per flight', () => {
    const model = access(['flight.update.own', 'flight.delete.own']);
    expect(model.canUpdateFlight(ownFlight)).toBe(true);
    expect(model.canUpdateFlight(otherFlight)).toBe(false);
    expect(model.canDeleteFlight(ownFlight)).toBe(true);
    expect(model.canDeleteFlight(otherFlight)).toBe(false);
  });

  it('allows bulk deletion only when every visible flight is deletable', () => {
    expect(access(['flight.delete.own']).canBulkDelete([ownFlight])).toBe(true);
    expect(
      access(['flight.delete.own']).canBulkDelete([ownFlight, otherFlight]),
    ).toBe(false);
  });

  it('disables every mutation in read-only contexts', () => {
    const model = access(
      ['flight.create.any', 'flight.update.any', 'flight.delete.any'],
      true,
    );
    expect(model.canCreateFlight).toBe(false);
    expect(model.canUpdateFlight(ownFlight)).toBe(false);
    expect(model.canDeleteFlight(ownFlight)).toBe(false);
  });
});
