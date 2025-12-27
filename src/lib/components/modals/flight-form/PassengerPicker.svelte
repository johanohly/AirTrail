<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { User, UserPlus, UserRoundPlus } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fly } from 'svelte/transition';

  import { page } from '$app/state';
  import UserModal from '$lib/components/modals/settings/pages/users-page/UserModal.svelte';
  import type { User as UserType } from '$lib/db/types';
  import { cn } from '$lib/utils';

  let {
    userId = $bindable<string | null>(null),
    guestName = $bindable<string | null>(null),
    excludeUserIds = [],
    placeholderError = false,
  }: {
    userId?: string | null;
    guestName?: string | null;
    excludeUserIds?: string[];
    placeholderError?: boolean;
  } = $props();

  let createUser = $state(false);
  let pendingDisplayName = $state('');

  const canCreateUser = $derived(
    page.data.user?.role === 'admin' || page.data.user?.role === 'owner',
  );

  const getUsers = () => (page.data.users as UserType[]) ?? [];

  const availableUsers = $derived.by(() => {
    const users = getUsers();
    return users.filter(
      (u) => u.id === userId || !excludeUserIds.includes(u.id),
    );
  });

  const getDisplayValue = (): string => {
    if (userId) {
      const users = getUsers();
      const user = users.find((u) => u.id === userId);
      return user?.displayName ?? '';
    }
    return guestName ?? '';
  };

  type SelectionValue =
    | { type: 'user'; user: UserType }
    | { type: 'guest'; name: string }
    | { type: 'create'; name: string };

  const buildSelectedOption = ():
    | { label: string; value: SelectionValue }
    | undefined => {
    if (userId) {
      const users = getUsers();
      const user = users.find((u) => u.id === userId);
      if (user) {
        return {
          label: user.displayName,
          value: { type: 'user', user },
        };
      }
    }
    if (guestName) {
      return {
        label: guestName,
        value: { type: 'guest', name: guestName },
      };
    }
    return undefined;
  };

  const selected = writable(buildSelectedOption());

  const {
    elements: { menu, input, option },
    states: { open, inputValue },
  } = createCombobox<SelectionValue>({
    forceVisible: true,
    selected,
    onSelectedChange: ({ next }) => {
      if (!next?.value) {
        userId = null;
        guestName = null;
        return next;
      }

      if (next.value.type === 'create') {
        // Open modal, don't change selection
        pendingDisplayName = next.value.name;
        createUser = true;
        return undefined;
      }

      if (next.value.type === 'user') {
        userId = next.value.user.id;
        guestName = null;
      } else {
        userId = null;
        guestName = next.value.name;
      }

      return next;
    },
  });

  $effect(() => {
    const currentDisplay = getDisplayValue();
    if ($selected?.label !== currentDisplay) {
      const newSelection = buildSelectedOption();
      if (newSelection) {
        selected.set(newSelection);
      } else {
        // @ts-expect-error - melt-ui accepts undefined to clear selection
        selected.set(undefined);
      }
    }
  });

  $effect(() => {
    if (!$open) {
      $inputValue = $selected?.label ?? '';
    }
  });

  const filteredUsers = $derived.by(() => {
    if (!$inputValue) return availableUsers;
    const search = $inputValue.toLowerCase();
    return availableUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search),
    );
  });

  const showGuestOption = $derived($inputValue.trim().length > 0);
  const trimmedInput = $derived($inputValue.trim());

  const handleUserCreated = (username: string) => {
    // Find the newly created user by username and auto-select them
    const users = getUsers();
    const newUser = users.find((u) => u.username === username);
    if (newUser) {
      userId = newUser.id;
      guestName = null;
      selected.set({
        label: newUser.displayName,
        value: { type: 'user', user: newUser },
      });
    }
  };
</script>

<div class="w-full">
  <div class="relative">
    <input
      use:melt={$input}
      placeholder="Passenger Name"
      class={cn(
        'w-full min-w-0 bg-transparent text-sm font-medium outline-none transition-all',
        'placeholder:text-muted-foreground/60',
        'border-b border-transparent py-0.5',
        'focus:border-border',
        {
          'placeholder:text-destructive': placeholderError,
        },
      )}
    />
  </div>

  {#if $open}
    <ul
      class="pointer-events-auto z-5000 flex max-h-[300px] flex-col overflow-hidden rounded-lg mt-1 border bg-popover shadow-lg"
      use:melt={$menu}
      transition:fly={{ duration: 150, y: -5 }}
    >
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="flex max-h-full flex-col overflow-y-auto"
        tabindex="0"
        use:autoAnimate
      >
        {#if filteredUsers.length > 0}
          <div class="p-1">
            {#each filteredUsers as user (user.id)}
              <li
                use:melt={$option({
                  value: { type: 'user', user },
                  label: user.displayName,
                })}
                class="cursor-pointer rounded-md px-2.5 py-2 flex items-center gap-2.5 data-highlighted:bg-accent data-selected:ring-2 data-selected:ring-primary transition-colors"
              >
                <div
                  class="size-7 rounded-full bg-muted flex items-center justify-center shrink-0"
                >
                  <User size={14} class="text-muted-foreground" />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="truncate text-sm font-medium"
                    >{user.displayName}</span
                  >
                  <span class="truncate text-xs text-muted-foreground"
                    >@{user.username}</span
                  >
                </div>
              </li>
            {/each}
          </div>
        {:else if !showGuestOption}
          <div class="px-3 py-3 text-sm text-muted-foreground">
            Start typing to search...
          </div>
        {/if}

        {#if showGuestOption}
          <div class="border-t bg-muted/50 p-1">
            <li
              use:melt={$option({
                value: { type: 'guest', name: trimmedInput },
                label: trimmedInput,
              })}
              class="cursor-pointer rounded-md px-2.5 py-2 flex items-center gap-2.5 data-highlighted:bg-background data-selected:ring-2 data-selected:ring-primary transition-colors"
            >
              <div
                class="size-7 rounded-full bg-muted flex items-center justify-center shrink-0"
              >
                <UserPlus size={14} class="text-muted-foreground" />
              </div>
              <span class="text-sm text-muted-foreground">
                Use "<span class="font-medium text-foreground"
                  >{trimmedInput}</span
                >" as guest
              </span>
            </li>
            {#if canCreateUser}
              <li
                use:melt={$option({
                  value: { type: 'create', name: trimmedInput },
                  label: trimmedInput,
                })}
                class="cursor-pointer rounded-md px-2.5 py-2 flex items-center gap-2.5 data-highlighted:bg-background transition-colors"
              >
                <div
                  class="size-7 rounded-full bg-muted flex items-center justify-center shrink-0"
                >
                  <UserRoundPlus size={14} class="text-muted-foreground" />
                </div>
                <span class="text-sm text-muted-foreground">
                  Create new user "<span class="font-medium text-foreground"
                    >{trimmedInput}</span
                  >"
                </span>
              </li>
            {/if}
          </div>
        {/if}
      </div>
    </ul>
  {/if}
</div>

<UserModal
  bind:open={createUser}
  mode="add"
  initialDisplayName={pendingDisplayName}
  onSuccess={handleUserCreated}
/>
