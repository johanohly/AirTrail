<script lang="ts">
  import { cn } from '$lib/utils';
  import { Separator } from '$lib/components/ui/separator';
  import { crossfade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Modal } from '$lib/components/ui/modal';
  import { Button } from '$lib/components/ui/button';
  import { ImportPage, GeneralPage, AppearancePage, UsersPage } from './pages';
  import type { User } from 'lucia';

  const SETTINGS_PAGES = [
    { title: 'General', id: 'general' },
    { title: 'Users', id: 'users' },
    { title: 'Appearance', id: 'appearance' },
    { title: 'Import', id: 'import' },
  ] as const;

  let {
    open = $bindable(),
    user,
    invalidator,
    activeTab = 'general',
  }: {
    open: boolean;
    user: User;
    invalidator?: { onSuccess: () => void };
    activeTab?: (typeof SETTINGS_PAGES)[number]['id'];
  } = $props();

  const [send, receive] = crossfade({
    duration: 250,
    easing: cubicInOut,
  });

  const authorized_pages = SETTINGS_PAGES.filter((page) => {
    if (user.role !== 'user') return true;
    return page.id !== 'users';
  });
</script>

<Modal bind:open classes="max-w-2xl">
  <div class="space-y-6">
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">
        {#if user.role !== 'user'}
          Manage your AirTrail instance.
        {:else}
          Manage your account settings.
        {/if}
      </p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="md:-mx-4 lg:w-1/5">
        <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          {#each authorized_pages as item}
            {@const isActive = activeTab === item.id}

            <Button
              on:click={() => (activeTab = item.id)}
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
                {item.title}
              </div>
            </Button>
          {/each}
        </nav>
      </aside>
      <div class="flex-1 lg:max-w-2xl">
        {#if activeTab === 'general'}
          <GeneralPage />
        {:else if activeTab === 'users'}
          <UsersPage />
        {:else if activeTab === 'appearance'}
          <AppearancePage />
        {:else if activeTab === 'import'}
          <ImportPage {invalidator} />
        {/if}
      </div>
    </div>
  </div>
</Modal>
