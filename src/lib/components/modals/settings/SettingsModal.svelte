<script lang="ts">
  import { cubicInOut } from 'svelte/easing';
  import { crossfade } from 'svelte/transition';

  import {
    ImportPage,
    GeneralPage,
    AppearancePage,
    UsersPage,
    ExportPage,
    OAuthPage,
    SecurityPage,
    DataPage,
    IntegrationsPage,
  } from './pages';

  import { page } from '$app/state';
  import SettingsTabContainer from '$lib/components/modals/settings/SettingsTabContainer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';
  import { Separator } from '$lib/components/ui/separator';
  import { cn } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  const ACCOUNT_SETTINGS = [
    { title: 'General', id: 'general' },
    { title: 'Security', id: 'security' },
    { title: 'Appearance', id: 'appearance' },
    { title: 'Import', id: 'import' },
    { title: 'Export', id: 'export' },
  ] as const;
  const ADMIN_SETTINGS = [
    { title: 'Data', id: 'data' },
    { title: 'Integrations', id: 'integrations' },
    { title: 'Users', id: 'users' },
    { title: 'OAuth', id: 'oauth' },
  ] as const;
  type TabId =
    | (typeof ACCOUNT_SETTINGS)[number]['id']
    | (typeof ADMIN_SETTINGS)[number]['id'];

  let {
    open = $bindable(),
  }: {
    open: boolean;
  } = $props();

  let activeTab: TabId = $state('general');
  $effect(() => {
    if (!open) {
      activeTab = 'general';
    }
  });

  const user = $derived(page.data.user);

  const [send, receive] = crossfade({
    duration: 250,
    easing: cubicInOut,
  });
</script>

<Modal bind:open class="max-w-2xl">
  <div class="space-y-6">
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">
        {#if !user || user.role === 'user'}
          Manage your account settings and preferences.
        {:else}
          Manage your AirTrail instance and system configuration.
        {/if}
      </p>
    </div>
    <Separator />
    <div class="flex flex-col gap-8 md:flex-row md:gap-16">
      <aside class="flex md:flex-col md:-mx-4 md:w-1/5 overflow-auto">
        <SettingsTabContainer>
          {#each ACCOUNT_SETTINGS as setting}
            {@const isActive = activeTab === setting.id}

            <Button
              onclick={() => (activeTab = setting.id)}
              variant="ghost"
              class={cn(
                'relative justify-start transition-all duration-200 font-medium',
                isActive
                  ? 'text-primary bg-primary/10 hover:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card-hover',
              )}
              data-sveltekit-noscroll
            >
              {#if isActive}
                <div
                  class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                  in:send={{ key: 'active-sidebar-indicator' }}
                  out:receive={{ key: 'active-sidebar-indicator' }}
                />
              {/if}
              <div class="relative">
                {setting.title}
              </div>
            </Button>
          {/each}
        </SettingsTabContainer>
        {#if user && user.role !== 'user'}
          <Separator
            class="my-2"
            orientation={$isMediumScreen ? 'horizontal' : 'vertical'}
          />
          <SettingsTabContainer>
            {#each ADMIN_SETTINGS as setting}
              {@const isActive = activeTab === setting.id}

              <Button
                onclick={() => (activeTab = setting.id)}
                variant="ghost"
                class={cn(
                  'relative justify-start transition-all duration-200 font-medium',
                  isActive
                    ? 'text-primary bg-primary/10 hover:bg-primary/15'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card-hover',
                )}
                data-sveltekit-noscroll
              >
                {#if isActive}
                  <div
                    class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                    in:send={{ key: 'active-sidebar-indicator' }}
                    out:receive={{ key: 'active-sidebar-indicator' }}
                  />
                {/if}
                <div class="relative">
                  {setting.title}
                </div>
              </Button>
            {/each}
          </SettingsTabContainer>
        {/if}
      </aside>
      <div class="flex-1 md:max-w-2xl">
        {#if activeTab === 'general'}
          <GeneralPage />
        {:else if activeTab === 'security'}
          <SecurityPage />
        {:else if activeTab === 'appearance'}
          <AppearancePage />
        {:else if activeTab === 'import'}
          <ImportPage bind:open />
        {:else if activeTab === 'export'}
          <ExportPage />
        {:else if activeTab === 'data'}
          <DataPage />
        {:else if activeTab === 'integrations'}
          <IntegrationsPage />
        {:else if activeTab === 'users'}
          <UsersPage />
        {:else if activeTab === 'oauth'}
          <OAuthPage />
        {/if}
      </div>
    </div>
  </div>
</Modal>
