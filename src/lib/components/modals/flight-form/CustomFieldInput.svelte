<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';

  type FieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'boolean'
    | 'date'
    | 'select';

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

  const resolvedOptions = $derived(
    Array.isArray(options)
      ? options.filter((x): x is string => typeof x === 'string')
      : [],
  );

  const set = (v: unknown) => {
    value = v;
    onchange?.(v);
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
  {/if}

  {#if error}
    <p class="text-destructive text-sm font-medium">{error}</p>
  {:else if description}
    <p class="text-muted-foreground text-xs">{description}</p>
  {/if}
</div>
