<script lang="ts">
  import { ChevronDown, Lock, Plus, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Popover from '$lib/components/ui/popover';
  import { api, trpc } from '$lib/trpc';
  import {
    customFlightReasonsSchema,
    flightReasonLabel,
  } from '$lib/utils/flight-reasons';

  const query = trpc.user.flightReasons.query();
  let adding = $state(false);
  let name = $state('');
  let saving = $state(false);

  async function save(reasons: string[]) {
    const parsed = customFlightReasonsSchema.safeParse(reasons);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid flight reason');
      return;
    }
    saving = true;
    try {
      await api.user.updateFlightReasons.mutate(parsed.data);
      await trpc.user.flightReasons.utils.invalidate();
      adding = false;
      name = '';
    } catch {
      toast.error('Failed to update flight reasons');
    } finally {
      saving = false;
    }
  }
</script>

<section class="mb-8 space-y-3">
  <h3 class="text-lg font-medium">Flight reasons</h3>
  <p class="text-sm text-muted-foreground">
    Customize the reasons for your own passenger entry. Removing a reason keeps
    existing flight records unchanged.
  </p>
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          class="w-full max-w-sm justify-between"
          disabled={$query.isPending || $query.isError}
        >
          Manage flight reasons <ChevronDown size={16} />
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="start" class="w-80 space-y-1 p-2">
      {#each ['leisure', 'business', 'crew'] as reason}
        <div class="flex items-center justify-between px-2 py-1.5 text-sm">
          {flightReasonLabel(reason)}
          <Lock
            size={12}
            class="text-muted-foreground"
            aria-label="Built-in reason"
          />
        </div>
      {/each}
      {#each $query.data ?? [] as reason}
        <div class="flex items-center justify-between gap-2 pl-2 text-sm">
          <span class="min-w-0 break-words">{reason}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            aria-label={`Remove ${reason}`}
            onclick={() =>
              save(($query.data ?? []).filter((value) => value !== reason))}
          >
            <X size={14} />
          </Button>
        </div>
      {/each}
      {#if adding}
        <form
          class="flex gap-2 p-1"
          onsubmit={(event) => {
            event.preventDefault();
            void save([...($query.data ?? []), name]);
          }}
        >
          <Input
            bind:value={name}
            maxlength={100}
            aria-label="New flight reason"
            placeholder="Study abroad"
            disabled={saving}
          />
          <Button type="submit" size="sm" disabled={saving || !name.trim()}
            >Add</Button
          >
        </form>
      {:else}
        <Button
          variant="ghost"
          size="sm"
          class="w-full justify-start"
          disabled={saving}
          onclick={() => (adding = true)}
        >
          <Plus size={14} /> Add reason
        </Button>
      {/if}
      <div class="flex items-center justify-between px-2 py-1.5 text-sm">
        Other <Lock
          size={12}
          class="text-muted-foreground"
          aria-label="Built-in reason"
        />
      </div>
    </Popover.Content>
  </Popover.Root>
  {#if $query.isError}<p class="text-sm text-destructive">
      Failed to load flight reasons.
    </p>{/if}
</section>
