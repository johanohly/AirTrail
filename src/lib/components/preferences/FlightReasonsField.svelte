<script lang="ts">
  import { Plus, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { api, trpc } from '$lib/trpc';
  import { customFlightReasonsSchema } from '$lib/utils/flight-reasons';

  const query = trpc.user.flightReasons.query();
  const reasons = $derived($query.data ?? []);
  let name = $state('');
  let saving = $state(false);

  const save = async (next: string[]) => {
    const parsed = customFlightReasonsSchema.safeParse(next);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid flight reason');
      return false;
    }
    saving = true;
    try {
      await api.user.updateFlightReasons.mutate(parsed.data);
      await trpc.user.flightReasons.utils.invalidate();
      return true;
    } catch {
      toast.error('Failed to update flight reasons');
      return false;
    } finally {
      saving = false;
    }
  };

  const add = async (event: SubmitEvent) => {
    event.preventDefault();
    if (await save([...reasons, name])) name = '';
  };
</script>

{#if reasons.length}
  <ul class="flex flex-wrap gap-2">
    {#each reasons as reason (reason)}
      <li
        class="flex h-8 min-w-0 max-w-full items-center gap-1 rounded-md border bg-muted/40 pl-3 pr-1 text-sm"
      >
        <span class="truncate" title={reason}>{reason}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          class="size-6 shrink-0 text-muted-foreground"
          disabled={saving}
          aria-label={`Remove ${reason}`}
          onclick={() => save(reasons.filter((value) => value !== reason))}
        >
          <X size={14} />
        </Button>
      </li>
    {/each}
  </ul>
{/if}
<form class="flex max-w-sm gap-2" onsubmit={add}>
  <Input
    bind:value={name}
    maxlength={100}
    aria-label="New flight reason"
    placeholder="New reason"
    disabled={saving || $query.isPending}
  />
  <Button
    type="submit"
    variant="outline"
    disabled={saving || !name.trim() || reasons.length >= 50}
  >
    <Plus />
    Add
  </Button>
</form>
{#if $query.isError}
  <p class="text-sm text-destructive">Failed to load flight reasons</p>
{/if}
