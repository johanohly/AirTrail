<script lang="ts">
  import '../app.css';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { trpc } from '$lib/trpc';
  import { Toaster } from 'svelte-sonner';
  import { ModeWatcher } from 'mode-watcher';
  import { ScreenSize } from '$lib/components/helpers';
  import { appConfig } from '$lib/utils/stores';
  import { openModalsState } from '$lib/stores.svelte';
  import { page } from '$app/stores';
  import {
    AddFlightModal,
    NewVersionAnnouncement,
    SettingsModal,
  } from '$lib/components/modals';
  import { NavigationDock } from '$lib/components';
  import { dev } from '$app/environment';

  const { data, children } = $props();

  $effect(() => {
    appConfig.set(data.appConfig);
  });

  const queryClient = trpc.hydrateFromServer(data.trpc);
</script>

<ModeWatcher />
<ScreenSize />
<Toaster />

{#if !dev && data.user?.role !== 'user'}
  <NewVersionAnnouncement />
{/if}

<QueryClientProvider client={queryClient}>
  <SettingsModal bind:open={openModalsState.settings} />
  <AddFlightModal bind:open={openModalsState.addFlight} />

  {@render children()}

  {#if !$page.error && !['/login', '/setup'].includes($page.url.pathname)}
    <NavigationDock />
  {/if}
</QueryClientProvider>
