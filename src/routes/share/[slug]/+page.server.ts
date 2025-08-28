import type { PageServerLoad } from './$types';

import { trpcServer } from '$lib/server/server';

export const load: PageServerLoad = async (event) => {
  const { slug } = event.params;
  await trpcServer.share.public.ssr({ slug }, event);
};
