import { afterEach, describe, expect, it, vi } from 'vitest';

import { getParsedMetar } from './metar';

describe('getParsedMetar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('treats an empty response body as no metar', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 200 })),
    );

    const result = await getParsedMetar('EDDT');

    expect(result).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('parses a normal metar response', async () => {
    const payload = [
      {
        rawOb: 'EKCH 091350Z 24010KT 9999 FEW030 17/09 Q1013',
        obsTime: 1754747400,
        icaoId: 'EKCH',
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(payload)),
    );

    const result = await getParsedMetar('EKCH');

    expect(result?.raw).toBe('EKCH 091350Z 24010KT 9999 FEW030 17/09 Q1013');
  });
});
