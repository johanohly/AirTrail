<script lang="ts">
  import '../app.css';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { ModeWatcher } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import { registerSW } from 'virtual:pwa-register';

  import { page } from '$app/state';
  import { NavigationDock } from '$lib/components';
  import { TimeDisplayHost } from '$lib/components/display';
  import { ConfirmWrapper, ScreenSize } from '$lib/components/helpers';
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
    if (data.appConfig) {
      appConfig.config = data.appConfig.config;
      appConfig.configured = data.appConfig.configured;
      appConfig.envConfigured = data.appConfig.envConfigured;
    }
  });

  const queryClient = data.trpc ? trpc.hydrateFromServer(data.trpc) : undefined;

  onMount(() => {
    // Register the service worker so its precache + runtime map caching take
    // effect. SvelteKit doesn't run vite-plugin-pwa's HTML injection, so we
    // register manually here (the app is client-rendered, so onMount runs).
    registerSW({ immediate: true });
  });
</script>

<ModeWatcher />
<ScreenSize />
<Toaster />
<ConfirmWrapper />

{#if data.user && data.user.role !== 'user'}
  <NewVersionAnnouncement />
{/if}

{#if queryClient}
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SettingsModal bind:open={openModalsState.settings} />
      <AddFlightModal bind:open={openModalsState.addFlight} />
      <TimeDisplayHost />

      <main class="h-full" data-vaul-drawer-wrapper>
        {@render children()}
      </main>

      {#if data.user && !page.error && !['/login', '/setup'].includes(page.url.pathname)}
        <NavigationDock />
      {/if}
    </TooltipProvider>
  </QueryClientProvider>
{:else}
  <main class="h-full">
    {@render children()}
  </main>
{/if}
