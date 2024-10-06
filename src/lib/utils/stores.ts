import { type Writable, writable } from 'svelte/store';
import type { ClientAppConfig } from '$lib/db/types';

export const appConfig: Writable<ClientAppConfig | null> = writable(null);
