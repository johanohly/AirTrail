<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { cn } from '$lib/utils';
  import { api } from '$lib/trpc';
  import {
    getPreferences,
    matchPreset,
    presetList,
    type PresetKey,
  } from '$lib/utils/preferences';

  import type { Preferences } from '$lib/zod/user';

  let {
    mode = 'apply',
    current: currentOverride,
    onApplied,
  }: {
    /**
     * - 'apply' (default): write the preset through the user.updatePreferences
     *   mutation and invalidate the page. Used inside the Preferences page.
     * - 'select': bubble the picked preset up via `onApplied` without making a
     *   network call. Used during setup, where the form submission writes
     *   everything atomically.
     */
    mode?: 'apply' | 'select';
    /** Override the preferences used for the "active" indicator. */
    current?: Preferences;
    onApplied?: (key: PresetKey, values: Preferences) => void;
  } = $props();

  const resolved = $derived(currentOverride ?? getPreferences(page.data.user));
  const activeKey = $derived(matchPreset(resolved));
  let pendingKey = $state<PresetKey | null>(null);

  async function applyPreset(key: PresetKey) {
    const preset = presetList.find((p) => p.key === key);
    if (!preset) return;

    if (mode === 'select') {
      onApplied?.(key, preset.values);
      return;
    }

    if (key === activeKey) return;
    pendingKey = key;
    try {
      const ok = await api.user.updatePreferences.mutate(preset.values);
      if (!ok) throw new Error('No rows updated');
      await invalidateAll();
      toast.success(`Applied ${preset.label} preset`);
      onApplied?.(key, preset.values);
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply preset');
    } finally {
      pendingKey = null;
    }
  }
</script>

<div class="grid gap-2 sm:grid-cols-3">
  {#each presetList as preset}
    {@const isActive = activeKey === preset.key}
    {@const isPending = pendingKey === preset.key}
    <button
      type="button"
      onclick={() => applyPreset(preset.key)}
      disabled={isPending}
      class={cn(
        'flex h-full flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
        'hover:bg-accent disabled:opacity-60',
        isActive
          ? 'border-primary bg-primary/5'
          : 'border-border bg-background',
      )}
    >
      <span class="flex w-full items-center justify-between gap-2">
        <span class="text-sm font-semibold">{preset.label}</span>
        {#if isActive}
          <span
            class="text-[10px] font-medium uppercase tracking-wider text-primary"
          >
            Active
          </span>
        {/if}
      </span>
      <span class="text-xs text-muted-foreground leading-snug">
        {preset.description}
      </span>
    </button>
  {/each}
</div>
