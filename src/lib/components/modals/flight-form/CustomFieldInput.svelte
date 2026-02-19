<script lang="ts">
  import AircraftPicker from '$lib/components/form-fields/AircraftPicker.svelte';
  import AirlinePicker from '$lib/components/form-fields/AirlinePicker.svelte';
  import AirportPicker from '$lib/components/form-fields/AirportPicker.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import type { Aircraft, Airline, Airport } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import {
    isEntityType,
    normalizeOptions,
    type FieldType,
  } from '$lib/utils/custom-fields';

  // Module-level cache: avoids re-fetching the same entity on every mount
  const entityCache = new Map<string, Airport | Airline | Aircraft>();

  let {
    id,
    label,
    fieldType,
    required = false,
    options = [],
    description = '',
    value = $bindable<unknown>(null),
    error = '',
    onchange,
  }: {
    id?: string;
    label: string;
    fieldType: FieldType;
    required?: boolean;
    options?: string[];
    description?: string;
    value?: unknown;
    error?: string;
    onchange?: (value: unknown) => void;
  } = $props();

  const fieldId = $derived(
    id ?? `cf-${label.replace(/\s+/g, '-').toLowerCase()}`,
  );

  const resolvedOptions = $derived(normalizeOptions(options));

  const set = (v: unknown) => {
    value = v;
    onchange?.(v);
  };

  // Entity picker state: resolve numeric ID → full object for the picker
  let entityObj = $state<Airport | Airline | Aircraft | null>(null);
  let resolvedId = $state<number | null>(null);

  $effect(() => {
    if (!isEntityType(fieldType)) return;

    const numId = typeof value === 'number' ? value : null;

    // Already resolved this ID
    if (numId === resolvedId && entityObj) return;

    if (numId == null) {
      entityObj = null;
      resolvedId = null;
      return;
    }

    resolvedId = numId;
    const cacheKey = `${fieldType}-${numId}`;
    const cached = entityCache.get(cacheKey);
    if (cached) {
      entityObj = cached;
      return;
    }

    (async () => {
      try {
        let result: Airport | Airline | Aircraft | null = null;
        if (fieldType === 'airport') {
          result = await api.airport.get.query(numId);
        } else if (fieldType === 'airline') {
          result = await api.airline.get.query(numId);
        } else if (fieldType === 'aircraft') {
          result = await api.aircraft.get.query(numId);
        }
        if (result) {
          entityCache.set(cacheKey, result);
          entityObj = result;
        }
      } catch {
        entityObj = null;
      }
    })();
  });

  const onEntityChange = (entity: { id: number } | null) => {
    if (entity) {
      const obj = entity as Airport | Airline | Aircraft;
      entityCache.set(`${fieldType}-${entity.id}`, obj);
      entityObj = obj;
      resolvedId = entity.id;
      set(entity.id);
    } else {
      entityObj = null;
      resolvedId = null;
      set(null);
    }
  };
</script>

<div class="grid gap-1">
  <Label for={fieldId}>
    {label}{required ? ' *' : ''}
  </Label>

  {#if fieldType === 'text'}
    <Input
      id={fieldId}
      value={(value as string) ?? ''}
      oninput={(e) => set(e.currentTarget.value || null)}
      placeholder="Enter value..."
    />
  {:else if fieldType === 'textarea'}
    <textarea
      id={fieldId}
      class="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
      value={(value as string) ?? ''}
      oninput={(e) => set(e.currentTarget.value || null)}
    ></textarea>
  {:else if fieldType === 'number'}
    <Input
      id={fieldId}
      type="number"
      value={value == null ? '' : String(value)}
      oninput={(e) => {
        const raw = e.currentTarget.value;
        const parsed = Number(raw);
        set(raw === '' || Number.isNaN(parsed) ? null : parsed);
      }}
      placeholder="Enter value..."
    />
  {:else if fieldType === 'boolean'}
    <Switch
      id={fieldId}
      checked={Boolean(value)}
      onCheckedChange={(checked) => set(checked)}
    />
  {:else if fieldType === 'date'}
    <Input
      id={fieldId}
      type="date"
      value={(value as string) ?? ''}
      oninput={(e) => set(e.currentTarget.value || null)}
    />
  {:else if fieldType === 'select'}
    <Select.Root
      type="single"
      value={(value as string) ?? ''}
      onValueChange={(v) => set(v || null)}
    >
      <Select.Trigger id={fieldId}>
        {(value as string) || 'Select option'}
      </Select.Trigger>
      <Select.Content>
        {#each resolvedOptions as option (option)}
          <Select.Item value={option} label={option} />
        {/each}
      </Select.Content>
    </Select.Root>
  {:else if fieldType === 'airport'}
    <AirportPicker
      value={entityObj as Airport | null}
      compact
      onchange={(v) => onEntityChange(v)}
    />
  {:else if fieldType === 'airline'}
    <AirlinePicker
      value={entityObj as Airline | null}
      compact
      onchange={(v) => onEntityChange(v)}
    />
  {:else if fieldType === 'aircraft'}
    <AircraftPicker
      value={entityObj as Aircraft | null}
      compact
      onchange={(v) => onEntityChange(v)}
    />
  {/if}

  {#if error}
    <p class="text-destructive text-sm font-medium">{error}</p>
  {:else if description}
    <p class="text-muted-foreground text-xs">{description}</p>
  {/if}
</div>
