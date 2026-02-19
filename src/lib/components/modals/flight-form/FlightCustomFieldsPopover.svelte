<script lang="ts">
  import { SlidersHorizontal } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';

  import CustomFieldInput from './CustomFieldInput.svelte';
  import { isMediumScreen, isSmallScreen } from '$lib/utils/size';

  type Definition = {
    id: number;
    key: string;
    label: string;
    fieldType: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select';
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

  const getOptions = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string')
      : [];

  const setValue = (id: number, val: unknown) => {
    values = { ...values, [id]: val };
  };
</script>

<Button
  size="sm"
  variant="outline"
  class={$isSmallScreen ? '' : 'size-8 px-0'}
  disabled={disabled || !definitions.length}
  onclick={() => (open = true)}
>
  <SlidersHorizontal size={16} />
  {#if $isSmallScreen}
    Custom Fields
  {/if}
</Button>

<Modal bind:open class="max-w-md" closeOnOutsideClick={false}>
  <ModalHeader>
    <h2 class="text-lg font-medium">Custom Fields</h2>
  </ModalHeader>
  <ModalBody>
    <div class="grid gap-4">
      {#if definitions.length === 0}
        <p class="text-sm text-muted-foreground">
          No custom fields configured.
        </p>
      {:else}
        {#each definitions as field (field.id)}
          <CustomFieldInput
            id="cf-{field.id}"
            label={field.label}
            fieldType={field.fieldType}
            required={field.required}
            options={getOptions(field.options)}
            value={values[field.id] ?? null}
            onchange={(val) => setValue(field.id, val)}
          />
        {/each}
      {/if}
    </div>
  </ModalBody>
</Modal>
