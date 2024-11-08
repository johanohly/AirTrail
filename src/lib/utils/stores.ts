import { type Writable, writable } from 'svelte/store';
import type { ClientAppConfig } from '$lib/server/utils/config';

export const appConfig: Writable<ClientAppConfig | null> = writable(null);
