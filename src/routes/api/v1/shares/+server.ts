import { shareInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { createShare, listShares } from '$lib/server/api/v1/services/personal';

export const GET = apiRoute('shares.read', async ({ principal }) =>
  apiV1Data(await listShares(principal)),
);

export const POST = apiRoute('shares.write', async ({ principal, event }) => {
  const input = await parseJsonBody(event.request, shareInputSchema);
  const share = await createShare(principal, input);
  return apiV1Data(share, {
    status: 201,
    headers: { Location: `/api/v1/shares/${share.id}` },
  });
});
