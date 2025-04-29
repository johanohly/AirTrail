<script lang="ts">
  import '../app.css';
  // import "maplibre-theme/icons.lucide.css";
  // import "maplibre-theme/modern.css";
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from 'svelte-sonner';

  import { dev } from '$app/environment';
  import { page } from '$app/state';
  import { NavigationDock } from '$lib/components';
  import { ScreenSize } from '$lib/components/helpers';
  import {
    AddFlightModal,
    NewVersionAnnouncement,
    SettingsModal,
  } from '$lib/components/modals';
  import { Provider as TooltipProvider } from '$lib/components/ui/tooltip';
  import { appConfig, openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';

  const { data, children } = $props();

  $effect(() => {
    appConfig.config = data.appConfig.config;
    appConfig.envConfigured = data.appConfig.envConfigured;
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
  <TooltipProvider>
    <SettingsModal bind:open={openModalsState.settings} />
    <AddFlightModal bind:open={openModalsState.addFlight} />

    {@render children()}

    {#if !page.error && !['/login', '/setup'].includes(page.url.pathname)}
      <NavigationDock />
    {/if}
  </TooltipProvider>
</QueryClientProvider>
