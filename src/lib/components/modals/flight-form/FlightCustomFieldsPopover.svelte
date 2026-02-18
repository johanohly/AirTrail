<script lang="ts">
  import { SlidersHorizontal } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';

  type Definition = {
    id: number;
    key: string;
    label: string;
    fieldType: 'text' | 'number' | 'boolean' | 'date' | 'select';
    required: boolean;
    options: unknown;
  };

  let {
    definitions = [],
    values = $bindable<Record<number, unknown>>({}),
    disabled = false,
  }: {
    definitions?: Definition[];
    values?: Record<number, unknown>;
    disabled?: boolean;
  } = $props();

  let open = $state(false);

  const getOptions = (value: unknown): string[] => {
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string')
      : [];
  };

  const setValue = (id: number, value: unknown) => {
    values = { ...values, [id]: value };
  };
</script>

<Button
  variant="outline"
  size="icon"
  disabled={disabled || !definitions.length}
  onclick={() => (open = true)}
>
  <SlidersHorizontal size={16} />
</Button>

<Modal bind:open class="max-w-md" closeOnOutsideClick={false}>
  <ModalHeader>
    <h2 class="text-lg font-medium">Custom fields</h2>
  </ModalHeader>
  <ModalBody>
    <div class="space-y-3">
      {#if definitions.length === 0}
        <p class="text-sm text-muted-foreground">
          No custom fields configured.
        </p>
      {:else}
        {#each definitions as field (field.id)}
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">
              {field.label}{field.required ? ' *' : ''}
            </label>

            {#if field.fieldType === 'text'}
              <Input
                value={(values[field.id] as string) ?? ''}
                oninput={(e) =>
                  setValue(field.id, e.currentTarget.value || null)}
              />
            {:else if field.fieldType === 'number'}
              <Input
                type="number"
                value={values[field.id] == null ? '' : String(values[field.id])}
                oninput={(e) => {
                  const raw = e.currentTarget.value;
                  const parsed = Number(raw);
                  setValue(
                    field.id,
                    raw === '' || Number.isNaN(parsed) ? null : parsed,
                  );
                }}
              />
            {:else if field.fieldType === 'boolean'}
              <div
                class="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span class="text-sm">Enabled</span>
                <Switch
                  checked={Boolean(values[field.id])}
                  onCheckedChange={(checked) => setValue(field.id, checked)}
                />
              </div>
            {:else if field.fieldType === 'date'}
              <Input
                type="date"
                value={(values[field.id] as string) ?? ''}
                oninput={(e) =>
                  setValue(field.id, e.currentTarget.value || null)}
              />
            {:else if field.fieldType === 'select'}
              {@const options = getOptions(field.options)}
              <Select.Root
                type="single"
                value={(values[field.id] as string) ?? ''}
                onValueChange={(v) => setValue(field.id, v || null)}
              >
                <Select.Trigger>
                  {(values[field.id] as string) ?? 'Select option'}
                </Select.Trigger>
                <Select.Content>
                  {#each options as option (option)}
                    <Select.Item value={option} label={option} />
                  {/each}
                </Select.Content>
              </Select.Root>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </ModalBody>
</Modal>
