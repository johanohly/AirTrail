<script lang="ts">
  import { cubicInOut } from 'svelte/easing';
  import { crossfade } from 'svelte/transition';

  import {
    ImportPage,
    GeneralPage,
    PreferencesPage,
    AppearancePage,
    UsersPage,
    ExportPage,
    SharePage,
    OAuthPage,
    SecurityPage,
    DataPage,
    CustomFieldsPage,
    IntegrationsPage,
    RolesPage,
  } from './pages';

  import { version } from '$app/environment';
  import { page } from '$app/state';
  import {
    hasClientPermission,
    type Permission,
  } from '$lib/authorization/permissions';
  import SettingsTabContainer from '$lib/components/modals/settings/SettingsTabContainer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';
  import { Separator } from '$lib/components/ui/separator';
  import { openModalsState, versionState } from '$lib/state.svelte';
  import { cn } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';
  import { checkForNewVersions } from '$lib/utils/version';
  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';

  const ACCOUNT_SETTINGS = [
    { title: 'General', id: 'general', permission: null },
    { title: 'Preferences', id: 'preferences', permission: null },
    { title: 'Security', id: 'security', permission: null },
    { title: 'Appearance', id: 'appearance', permission: null },
    { title: 'Share', id: 'share', permission: null },
    { title: 'Import', id: 'import', permission: 'flight.import.own' },
    { title: 'Export', id: 'export', permission: 'flight.export.own' },
  ] as const;
  const ADMIN_SETTINGS = [
    {
      title: 'Data',
      id: 'data',
      permissions: [
        'data.airports.manage',
        'data.aircraft.manage',
        'data.airlines.manage',
      ],
    },
    {
      title: 'Custom Fields',
      id: 'custom-fields',
      permissions: ['custom_fields.manage'],
    },
    {
      title: 'Integrations',
      id: 'integrations',
      permissions: ['instance.integrations.manage'],
    },
    {
      title: 'Users',
      id: 'users',
      permissions: ['users.directory.read'],
    },
    { title: 'Roles', id: 'roles', permissions: ['roles.manage'] },
    {
      title: 'OAuth',
      id: 'oauth',
      permissions: ['instance.oauth.manage'],
    },
  ] as const;
  type SettingsTabId =
    | (typeof ACCOUNT_SETTINGS)[number]['id']
    | (typeof ADMIN_SETTINGS)[number]['id'];

  let {
    open = $bindable(),
  }: {
    open: boolean;
  } = $props();

  let activeTab: SettingsTabId = $state('general');
  let oauthDirty = $state(false);
  let oauthVisited = $state(false);
  $effect(() => {
    if (open) {
      activeTab = openModalsState.settingsTab;
    }
  });
  $effect(() => {
    if (open && activeTab === 'oauth') oauthVisited = true;
  });

  const user = $derived(page.data.user);
  const canAccessAdminSetting = (permissions: readonly Permission[]) =>
    permissions.some((permission) =>
      hasClientPermission(page.data.authorization, permission),
    );
  const canAccessAccountSetting = (permission: Permission | null) =>
    !permission || hasClientPermission(page.data.authorization, permission);
  const hasInstanceSettings = $derived(
    ADMIN_SETTINGS.some((setting) =>
      canAccessAdminSetting(setting.permissions),
    ),
  );
  const canAccessOAuth = $derived(
    canAccessAdminSetting(['instance.oauth.manage']),
  );

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) return;
    activeTab = 'general';
    oauthDirty = false;
    oauthVisited = false;
  };

  const [send, receive] = crossfade({
    duration: 250,
    easing: cubicInOut,
  });

  $effect(() => {
    if (
      open &&
      user &&
      hasClientPermission(page.data.authorization, 'instance.release.check') &&
      !versionState.alreadyChecked &&
      !versionState.isChecking
    ) {
      checkForNewVersions();
    }
  });
</script>

<Modal
  bind:open
  class="md:max-w-5xl"
  drawerNoPadding
  dismissal="form"
  dirty={oauthDirty}
  confirmExplicitClose
  onOpenChange={handleOpenChange}
>
  <AnimatedSizeContainer
    height={$isMediumScreen}
    class={cn(
      'max-md:px-6 max-md:py-3',
      $isMediumScreen ? '!overflow-x-visible' : '!overflow-visible',
    )}
  >
    <div
      class="flex flex-col gap-6 max-md:max-h-[calc(100dvh-200px)] max-md:overflow-y-auto"
    >
      <div class="space-y-0.5">
        <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
        <p class="text-muted-foreground">
          {#if !hasInstanceSettings}
            Manage your account settings and preferences.
          {:else}
            Manage your AirTrail instance and system configuration.
          {/if}
        </p>
      </div>
      <Separator />
      <div class="flex min-w-0 flex-col gap-8 md:flex-row md:gap-8">
        <aside class="flex overflow-x-auto md:w-44 md:shrink-0 md:flex-col">
          <SettingsTabContainer>
            {#each ACCOUNT_SETTINGS as setting}
              {#if canAccessAccountSetting(setting.permission)}
                {@const isActive = activeTab === setting.id}

                <Button
                  onclick={() => (activeTab = setting.id)}
                  variant="ghost"
                  class={cn(
                    'relative justify-start pl-5 transition-all duration-200 font-medium',
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
                    ></div>
                  {/if}
                  <div class="relative">
                    {setting.title}
                  </div>
                </Button>
              {/if}
            {/each}
          </SettingsTabContainer>
          {#if hasInstanceSettings}
            <Separator
              class="my-2"
              orientation={$isMediumScreen ? 'horizontal' : 'vertical'}
            />
            <SettingsTabContainer>
              {#each ADMIN_SETTINGS as setting}
                {#if canAccessAdminSetting(setting.permissions)}
                  {@const isActive = activeTab === setting.id}

                  <Button
                    onclick={() => (activeTab = setting.id)}
                    variant="ghost"
                    class={cn(
                      'relative justify-start pl-5 transition-all duration-200 font-medium',
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
                      ></div>
                    {/if}
                    <div class="relative">
                      {setting.title}
                    </div>
                  </Button>
                {/if}
              {/each}
            </SettingsTabContainer>
          {/if}
        </aside>
        <div class="min-w-0 flex-1 md:max-w-2xl">
          {#if activeTab === 'general'}
            <GeneralPage />
          {:else if activeTab === 'preferences'}
            <PreferencesPage />
          {:else if activeTab === 'security'}
            <SecurityPage />
          {:else if activeTab === 'appearance'}
            <AppearancePage />
          {:else if activeTab === 'share'}
            <SharePage />
          {:else if activeTab === 'import'}
            <ImportPage bind:open />
          {:else if activeTab === 'export'}
            <ExportPage />
          {:else if activeTab === 'data'}
            <DataPage />
          {:else if activeTab === 'custom-fields'}
            <CustomFieldsPage />
          {:else if activeTab === 'integrations'}
            <IntegrationsPage />
          {:else if activeTab === 'users'}
            <UsersPage />
          {:else if activeTab === 'roles'}
            <RolesPage />
          {/if}
          {#if open && oauthVisited && canAccessOAuth}
            <div hidden={activeTab !== 'oauth'}>
              <OAuthPage bind:dirty={oauthDirty} />
            </div>
          {/if}
        </div>
      </div>
      <div class="flex items-center justify-center">
        <p class="text-xs text-muted-foreground">
          Powered by
          <a
            href="https://github.com/johanohly/AirTrail"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-foreground hover:underline">AirTrail</a
          >
          {#if hasClientPermission(page.data.authorization, 'instance.release.check') && versionState.latestVersion && versionState.latestVersion !== version}
            ({version}, {versionState.latestVersion} available)
          {:else}
            ({version})
          {/if}
        </p>
      </div>
    </div>
  </AnimatedSizeContainer>
</Modal>
