<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { ChevronRight } from '@o7/icon/lucide';

  import CustomFieldInput from './CustomFieldInput.svelte';
  import { validateCustomFields } from './validate-custom-fields';

  import { cn } from '$lib/utils';
  import {
    normalizeOptions,
    type CustomFieldDefinition,
  } from '$lib/utils/custom-fields';

  let {
    definitions = [],
    values = $bindable<Record<number, unknown>>(),
    savedFieldIds,
    idPrefix = 'pcf',
    loading = false,
  }: {
    definitions?: CustomFieldDefinition[];
    values?: Record<number, unknown>;
    /** Field IDs that have values saved in the database. When provided,
     *  fields with defaults that aren't in this set are flagged as unsaved. */
    savedFieldIds?: Set<number>;
    idPrefix?: string;
    loading?: boolean;
  } = $props();

  let open = $state(false);
  let errors = $state<Record<number, string>>({});
  let wrapper = $state<HTMLDivElement>();

  // Seed default values whenever definitions or values change.
  // Only fills in fields that don't already have a value set.
  $effect(() => {
    if (!definitions.length) return;

    let changed = false;
    const next = { ...(values ?? {}) };
    for (const def of definitions) {
      if (def.defaultValue != null && !(def.id in next)) {
        next[def.id] = def.defaultValue;
        changed = true;
      }
    }
    if (changed) {
      values = next;
    }
  });

  const errorCount = $derived(Object.keys(errors).length);

  const setCount = $derived(
    definitions.filter((def) => {
      const v = (values ?? {})[def.id];
      return (
        v !== undefined &&
        v !== null &&
        v !== '' &&
        !(Array.isArray(v) && v.length === 0)
      );
    }).length,
  );

  /** True when there are defaulted field values that aren't yet saved on this entity. */
  const hasUnsavedDefaults = $derived.by(() => {
    if (!savedFieldIds) return false;
    return definitions.some(
      (def) => def.defaultValue != null && !savedFieldIds.has(def.id),
    );
  });

  const setValue = (id: number, val: unknown) => {
    values = { ...(values ?? {}), [id]: val };
    // Clear error for this field on change
    if (errors[id]) {
      const { [id]: _, ...rest } = errors;
      errors = rest;
    }
  };

  /**
   * Validate all custom field values. Returns true if valid.
   * If invalid, expands the section and shows per-field errors.
   */
  export function validate(): boolean {
    errors = validateCustomFields(definitions, values ?? {});
    if (errorCount > 0) {
      open = true;
      wrapper?.scrollIntoView({ block: 'nearest' });
      return false;
    }
    return true;
  }
</script>

{#if definitions.length > 0}
  <div bind:this={wrapper} use:autoAnimate>
    <button
      type="button"
      class={cn(
        'flex items-center gap-1 text-left text-xs transition',
        errorCount > 0
          ? 'text-destructive'
          : 'text-muted-foreground hover:text-foreground',
      )}
      disabled={loading}
      onclick={() => (open = !open)}
    >
      <ChevronRight
        size={12}
        class={cn('shrink-0 transition-transform', open && 'rotate-90')}
      />
      <span>
        {loading
          ? 'Loading custom fields...'
          : `Custom fields${setCount > 0 ? ` · ${setCount} set` : ''}`}
      </span>
      {#if errorCount > 0}
        <span>· {errorCount} {errorCount === 1 ? 'issue' : 'issues'}</span>
      {:else if hasUnsavedDefaults}
        <span class="text-amber-600 dark:text-amber-400">
          · defaults not saved
        </span>
      {/if}
    </button>
    {#if open && !loading}
      <div class="grid gap-3 pt-2">
        {#if hasUnsavedDefaults}
          <p class="text-xs text-amber-600 dark:text-amber-400">
            Some fields show default values that haven't been saved on this
            passenger yet. Saving the flight will apply them.
          </p>
        {/if}
        {#each definitions as field (field.id)}
          <CustomFieldInput
            id="{idPrefix}-{field.id}"
            label={field.label}
            description={field.description ?? ''}
            fieldType={field.fieldType}
            required={field.required}
            options={normalizeOptions(field.options)}
            error={errors[field.id] ?? ''}
            value={(values ?? {})[field.id] ?? null}
            onchange={(val) => setValue(field.id, val)}
          />
        {/each}
      </div>
    {/if}
  </div>
{/if}
