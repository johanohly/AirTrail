<script lang="ts" module>
  import {
    dateFormatOptions,
    distanceUnitOptions,
    flightTimeDisplayOptions,
    pressureUnitOptions,
    temperatureUnitOptions,
    timeFormatOptions,
    weekStartsOnOptions,
    windSpeedUnitOptions,
    type Option,
  } from '$lib/utils/preferences';
  import type { Preferences } from '$lib/zod/user';

  export type PreferenceField = keyof Preferences;

  // Cast the discriminated unions to a common shape so TS allows a single map.
  type AnyOption = Option<string>;

  export const FIELD_OPTIONS: Record<PreferenceField, AnyOption[]> = {
    distanceUnit: distanceUnitOptions as AnyOption[],
    windSpeedUnit: windSpeedUnitOptions as AnyOption[],
    temperatureUnit: temperatureUnitOptions as AnyOption[],
    pressureUnit: pressureUnitOptions as AnyOption[],
    timeFormat: timeFormatOptions as AnyOption[],
    dateFormat: dateFormatOptions as AnyOption[],
    weekStartsOn: weekStartsOnOptions as AnyOption[],
    flightTimeDisplay: flightTimeDisplayOptions as AnyOption[],
  };

  export const FIELD_LABELS: Record<PreferenceField, string> = {
    distanceUnit: 'Distance',
    windSpeedUnit: 'Wind speed',
    temperatureUnit: 'Temperature',
    pressureUnit: 'Pressure',
    timeFormat: 'Time format',
    dateFormat: 'Date format',
    weekStartsOn: 'Week starts on',
    flightTimeDisplay: 'Flight times',
  };
</script>

<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { api } from '$lib/trpc';
  import { defaultPreferences } from '$lib/utils/preferences';

  let {
    field,
    label,
    showLabel = true,
    value: controlledValue,
    onChange,
  }: {
    field: PreferenceField;
    label?: string;
    showLabel?: boolean;
    /**
     * Controlled mode: when both `value` and `onChange` are provided, the
     * field renders the given value and emits changes via `onChange` instead
     * of writing through the tRPC mutation. Used by the setup screen.
     */
    value?: string;
    onChange?: (value: string) => void;
  } = $props();

  const isControlled = $derived(onChange !== undefined);
  const options = $derived(FIELD_OPTIONS[field]);
  const labelText = $derived(label ?? FIELD_LABELS[field]);

  const stored = $derived<string>(
    isControlled
      ? (controlledValue ?? defaultPreferences[field])
      : ((page.data.user?.[field] as string | undefined) ??
          defaultPreferences[field]),
  );
  let pending = $state<string | null>(null);
  const value = $derived(pending ?? stored);
  const selected = $derived(options.find((o) => o.value === value));

  async function onValueChange(next: string) {
    if (!next || next === stored) return;
    if (isControlled) {
      onChange?.(next);
      return;
    }
    pending = next;
    try {
      const ok = await api.user.updatePreferences.mutate({
        [field]: next,
      });
      if (!ok) throw new Error('No rows updated');
      await invalidateAll();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update ${labelText.toLowerCase()}`);
    } finally {
      pending = null;
    }
  }
</script>

<div class="flex flex-col gap-1.5">
  {#if showLabel}
    <Label class="text-sm font-medium">{labelText}</Label>
  {/if}
  <Select.Root type="single" {value} {onValueChange}>
    <Select.Trigger class="w-full">
      {#if selected}
        <span
          class="flex min-w-0 flex-1 items-center gap-2"
          title={selected.label}
        >
          <span class="truncate">{selected.label}</span>
          {#if selected.hint}
            <span class="shrink-0 text-xs text-muted-foreground">
              {selected.hint}
            </span>
          {/if}
        </span>
      {:else}
        <span class="text-muted-foreground">Select…</span>
      {/if}
    </Select.Trigger>
    <Select.Content>
      {#each options as opt}
        <Select.Item value={opt.value} label={opt.label}>
          <div class="flex w-full flex-col gap-0.5">
            <div class="flex items-center justify-between gap-3">
              <span>{opt.label}</span>
              {#if opt.hint}
                <span class="text-xs text-muted-foreground">{opt.hint}</span>
              {/if}
            </div>
            {#if opt.description}
              <span class="text-xs text-muted-foreground leading-snug">
                {opt.description}
              </span>
            {/if}
          </div>
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</div>
