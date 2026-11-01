<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import { getPreferences } from '$lib/utils/preferences';

  let { class: className }: { class?: string } = $props();

  type Source = 'actual' | 'scheduled';

  const options: { value: Source; label: string; title: string }[] = [
    { value: 'actual', label: 'Actual', title: 'Show actual times' },
    { value: 'scheduled', label: 'Scheduled', title: 'Show scheduled times' },
  ];

  const stored = $derived(getPreferences(page.data.user).flightTimeSource);
  let pending = $state<Source | null>(null);
  const value = $derived(pending ?? stored);

  // Mirrors PreferenceField: optimistic flip, write through the same
  // mutation, then invalidate so `prefs` re-derives from the server.
  const select = async (next: Source) => {
    if (next === stored) return;
    pending = next;
    try {
      const ok = await api.user.updatePreferences.mutate({
        flightTimeSource: next,
      });
      if (!ok) throw new Error('No rows updated');
      await invalidateAll();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update flight list times');
    } finally {
      pending = null;
    }
  };
</script>

<div
  role="group"
  data-testid="flight-time-source-toggle"
  class={cn('flex rounded-md border bg-muted/60 p-0.5', className)}
>
  {#each options as option (option.value)}
    <button
      type="button"
      aria-pressed={value === option.value}
      data-testid={`flight-time-source-${option.value}`}
      title={option.title}
      onclick={() => select(option.value)}
      class={cn(
        'rounded px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        value === option.value
          ? 'bg-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {option.label}
    </button>
  {/each}
</div>
