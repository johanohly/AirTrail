<script lang="ts">
  import { Check, ChevronDown } from '@o7/icon/lucide';
  import { onMount } from 'svelte';

  import { page } from '$app/state';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';

  const INSTALL_URL =
    'https://airtrail.johan.ohly.dk/docs/overview/quick-start';

  let {
    demo,
  }: {
    demo: {
      endsAt: string | null;
      accounts: {
        key: string;
        username: string;
        displayName: string;
        description: string;
      }[];
    };
  } = $props();

  const current = $derived(
    demo.accounts.find(({ username }) => username === page.data.user?.username),
  );

  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const timeLeft = $derived.by(() => {
    if (!demo.endsAt) return null;
    const seconds = Math.max(
      0,
      Math.floor((Date.parse(demo.endsAt) - now) / 1000),
    );
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  });

  let open = $state(false);
</script>

<div
  class="z-10 absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border bg-background/70 backdrop-blur-md py-1 pl-3 pr-1 text-sm shadow-xs"
>
  <span class="text-muted-foreground">Demo</span>
  {#if timeLeft}
    <span
      class="text-muted-foreground tabular-nums"
      title="Time left before this demo resets"
    >
      · {timeLeft}
    </span>
  {/if}

  <Popover.Root bind:open>
    <Popover.Trigger
      class="ml-1 flex items-center gap-1 rounded-full px-2 py-1 font-medium hover:bg-accent"
    >
      {current?.displayName ?? page.data.user?.displayName}
      <ChevronDown size={14} class="text-muted-foreground" />
    </Popover.Trigger>
    <Popover.Content class="w-72 p-1" align="center">
      <p class="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
        Try AirTrail as
      </p>
      {#each demo.accounts as account (account.key)}
        <a
          href="/demo?as={account.key}"
          data-sveltekit-reload
          class={cn(
            'flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent',
            { 'pointer-events-none': account.key === current?.key },
          )}
        >
          <div class="flex-1">
            <div class="font-medium">{account.displayName}</div>
            <div class="text-xs text-muted-foreground">
              {account.description}
            </div>
          </div>
          {#if account.key === current?.key}
            <Check size={16} class="mt-0.5 text-muted-foreground" />
          {/if}
        </a>
      {/each}
    </Popover.Content>
  </Popover.Root>

  <a
    href={INSTALL_URL}
    target="_blank"
    rel="noreferrer"
    class="rounded-full bg-primary dark:bg-foreground px-3 py-1 font-medium text-primary-foreground"
  >
    Install
  </a>
</div>
