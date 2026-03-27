<script lang="ts">
  import { Info } from '@o7/icon/lucide';
  import { page } from '$app/state';

  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from '$lib/components/ui/popover';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import * as Select from '$lib/components/ui/select';
  import {
    flightScopeState,
    setFlightScope,
    type FlightScope,
  } from '$lib/state.svelte';

  const users = $derived(page.data.users);

  const scopeLabel = $derived.by(() => {
    if (flightScopeState.scope === 'all') return 'everyone';
    if (flightScopeState.scope === 'user') {
      const scopedUser = users.find((u) => u.id === flightScopeState.userId);
      return scopedUser?.displayName ?? 'selected user';
    }
    return 'you';
  });

  const updateScope = (scope: FlightScope) => {
    setFlightScope(
      scope,
      scope === 'user' ? (flightScopeState.userId ?? users[0]?.id) : undefined,
    );
  };
</script>

<div
  class="flex items-center gap-2 rounded-lg border border-dashed bg-muted px-3 py-2 text-sm text-muted-foreground"
>
  <Info class="size-4 shrink-0" />
  <span class="truncate">
    Showing flights for <strong class="text-foreground">{scopeLabel}</strong>
  </span>
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" size="sm" class="ml-auto shrink-0">
          Change
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="end" class="w-[320px] space-y-3 p-3">
      <div>
        <p class="text-sm font-medium">Flight visibility</p>
      </div>
      <RadioGroup.Root
        value={flightScopeState.scope}
        onValueChange={(value) => updateScope(value as FlightScope)}
        class="grid grid-cols-3 gap-2"
      >
        <Label
          class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
        >
          <RadioGroup.Item value="mine" class="sr-only" />
          Mine
        </Label>
        <Label
          class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
        >
          <RadioGroup.Item value="user" class="sr-only" />
          User
        </Label>
        <Label
          class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
        >
          <RadioGroup.Item value="all" class="sr-only" />
          All
        </Label>
      </RadioGroup.Root>

      {#if flightScopeState.scope === 'user'}
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground">User</p>
          <Select.Root
            type="single"
            value={flightScopeState.userId}
            onValueChange={(value) => setFlightScope('user', value)}
          >
            <Select.Trigger>
              {users.find((u) => u.id === flightScopeState.userId)
                ?.displayName ?? 'Select a user'}
            </Select.Trigger>
            <Select.Content>
              {#each users as user (user.id)}
                <Select.Item value={user.id} label={user.displayName} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
