import { trpcServer } from '$lib/server/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// You don't need to return the result of this function,
	// just call it and your data will be hydrated!
	await trpcServer.greeting.ssr({ name: 'the o7 stack' }, event);
};
