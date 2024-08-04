import { createTRPCSvelte } from 'trpc-svelte-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '$lib/server/routes/_app';
import { transformer } from './transformer';

export const trpc = createTRPCSvelte<AppRouter>({
	links: [
		httpBatchLink({
			url: '/api/trpc',
		}),
	],
	transformer,
});
