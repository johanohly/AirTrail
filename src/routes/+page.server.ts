import type { PageServerLoad } from './$types';

import { prefetchFlightPageData } from '$lib/server/utils/flight-page';

export const load: PageServerLoad = async (event) => {
  await prefetchFlightPageData(event);
};
