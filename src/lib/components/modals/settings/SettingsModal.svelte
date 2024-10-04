<script lang="ts">
  import { cn } from '$lib/utils';
  import { Separator } from '$lib/components/ui/separator';
  import { crossfade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Modal } from '$lib/components/ui/modal';
  import { Button } from '$lib/components/ui/button';
  import {
    ImportPage,
    GeneralPage,
    AppearancePage,
    UsersPage,
    ExportPage,
    OAuthPage,
    SecurityPage,
  } from './pages';
  import { page } from '$app/stores';
  import { isLargeScreen } from '$lib/utils/size';
  import SettingsTabContainer from '$lib/components/modals/settings/SettingsTabContainer.svelte';

  const ACCOUNT_SETTINGS = [
    { title: 'General', id: 'general' },
    { title: 'Security', id: 'security' },
    { title: 'Appearance', id: 'appearance' },
    { title: 'Import', id: 'import' },
    { title: 'Export', id: 'export' },
  ] as const;
  const ADMIN_SETTINGS = [
    { title: 'Users', id: 'users' },
    { title: 'OAuth', id: 'oauth' },
  ];

  let {
    open = $bindable(),
    activeTab = 'general',
  }: {
    open: boolean;
    activeTab?:
      | (typeof ACCOUNT_SETTINGS)[number]['id']
      | (typeof ADMIN_SETTINGS)[number]['id'];
  } = $props();

  const user = $derived($page.data.user);

  const [send, receive] = crossfade({
    duration: 250,
    easing: cubicInOut,
  });
</script>

<Modal bind:open classes="max-w-2xl">
  <div class="space-y-6">
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">
        {#if !user || user.role === 'user'}
          Manage your account settings.
        {:else}
          Manage your AirTrail instance.
        {/if}
      </p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="flex lg:flex-col md:-mx-4 lg:w-1/5 overflow-auto">
        <SettingsTabContainer>
          {#each ACCOUNT_SETTINGS as setting}
            {@const isActive = activeTab === setting.id}

            <Button
              on:click={() => (activeTab = setting.id)}
              variant="ghost"
              class={cn(
                !isActive && 'hover:underline',
                'relative justify-start hover:bg-transparent',
              )}
              data-sveltekit-noscroll
            >
              {#if isActive}
                <div
                  class="bg-card-hover absolute inset-0 rounded-md"
                  in:send={{ key: 'active-sidebar-tab' }}
                  out:receive={{ key: 'active-sidebar-tab' }}
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
            orientation={$isLargeScreen ? 'horizontal' : 'vertical'}
          />
          <SettingsTabContainer>
            {#each ADMIN_SETTINGS as setting}
              {@const isActive = activeTab === setting.id}

              <Button
                on:click={() => (activeTab = setting.id)}
                variant="ghost"
                class={cn(
                  !isActive && 'hover:underline',
                  'relative justify-start hover:bg-transparent',
                )}
                data-sveltekit-noscroll
              >
                {#if isActive}
                  <div
                    class="bg-card-hover absolute inset-0 rounded-md"
                    in:send={{ key: 'active-sidebar-tab' }}
                    out:receive={{ key: 'active-sidebar-tab' }}
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
      <div class="flex-1 lg:max-w-2xl">
        {#if activeTab === 'general'}
          <GeneralPage />
        {:else if activeTab === 'security'}
          <SecurityPage />
        {:else if activeTab === 'appearance'}
          <AppearancePage />
        {:else if activeTab === 'import'}
          <ImportPage />
        {:else if activeTab === 'export'}
          <ExportPage />
        {:else if activeTab === 'users'}
          <UsersPage />
        {:else if activeTab === 'oauth'}
          <OAuthPage />
        {/if}
      </div>
    </div>
  </div>
</Modal>
