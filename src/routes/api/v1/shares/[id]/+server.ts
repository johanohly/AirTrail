import { shareInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { deleteShare, updateShare } from '$lib/server/api/v1/services/personal';

export const PUT = apiRoute('shares.write', async ({ principal, event }) => {
  const id = parsePositiveId(event.params.id!);
  const input = await parseJsonBody(event.request, shareInputSchema);
  return apiV1Data(await updateShare(principal, id, input));
});

export const DELETE = apiRoute('shares.write', async ({ principal, event }) => {
  await deleteShare(principal, parsePositiveId(event.params.id!));
  return new Response(null, { status: 204 });
});
