<script lang="ts">
  import { SlidersHorizontal } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';

  import CustomFieldInput from './CustomFieldInput.svelte';
  import { validateCustomFields } from './validate-custom-fields';
  import { isSmallScreen } from '$lib/utils/size';

  type Definition = {
    id: number;
    key: string;
    label: string;
    fieldType: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select';
    required: boolean;
    options: unknown;
    validationJson: unknown;
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
  let errors = $state<Record<number, string>>({});

  const errorCount = $derived(Object.keys(errors).length);

  const getOptions = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string')
      : [];

  const setValue = (id: number, val: unknown) => {
    values = { ...values, [id]: val };
    // Clear error for this field on change
    if (errors[id]) {
      const { [id]: _, ...rest } = errors;
      errors = rest;
    }
  };

  /**
   * Validate all custom field values. Returns true if valid.
   * If invalid, opens the popover and shows per-field errors.
   */
  export function validate(): boolean {
    errors = validateCustomFields(definitions, values);
    if (errorCount > 0) {
      open = true;
      return false;
    }
    return true;
  }
</script>

<Button
  size={$isSmallScreen ? 'sm' : 'icon-sm'}
  variant="outline"
  class={errorCount > 0
    ? 'relative overflow-visible border-destructive text-destructive'
    : ''}
  disabled={disabled || !definitions.length}
  onclick={() => (open = true)}
>
  <SlidersHorizontal size={16} />
  {#if $isSmallScreen}
    Custom Fields
  {/if}
  {#if errorCount > 0}
    <span
      class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
    >
      !
    </span>
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
            error={errors[field.id] ?? ''}
            value={values[field.id] ?? null}
            onchange={(val) => setValue(field.id, val)}
          />
        {/each}
      {/if}
    </div>
  </ModalBody>
</Modal>
