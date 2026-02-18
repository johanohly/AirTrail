<script lang="ts">
  import { SlidersHorizontal } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { CustomFieldInput } from '$lib/components/modals/flight-form';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as Select from '$lib/components/ui/select';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { api, trpc } from '$lib/trpc';

  import {
    FIELD_TYPE_LABELS,
    type DefinitionItem,
    type EditingState,
    type FieldType,
  } from './types';
  import {
    buildPayload,
    createBlankEditing,
    getPreviewValue,
    isTextLike,
    itemToEditing,
    setPreviewValue,
    toKey,
    validatePayload,
  } from './helpers';

  let {
    open = $bindable(false),
    definitionCount = 0,
  }: {
    open?: boolean;
    definitionCount?: number;
  } = $props();

  let editing = $state<EditingState | null>(null);
  let autoKey = $state(false);

  export function openCreate() {
    editing = createBlankEditing(definitionCount);
    autoKey = true;
    open = true;
  }

  export function openEdit(item: DefinitionItem) {
    editing = itemToEditing(item);
    autoKey = false;
    open = true;
  }

  const close = () => {
    open = false;
    editing = null;
    autoKey = false;
  };

  const onLabelInput = (value: string) => {
    if (!editing) return;

    const previousAutoKey = toKey(editing.label);
    if (editing.key !== previousAutoKey) {
      autoKey = false;
    }

    editing.label = value;

    if (autoKey) {
      editing.key = toKey(value);
    }
  };

  const onKeyInput = (value: string) => {
    if (!editing) return;
    editing.key = value;
    autoKey = false;
  };

  const invalidate = () => {
    trpc.customField.listDefinitions.utils.invalidate({
      entityType: 'flight',
      includeInactive: true,
    });
  };

  const save = async () => {
    if (!editing) return;

    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload(editing);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid default value');
      return;
    }

    const error = validatePayload(editing, payload);
    if (error) {
      toast.error(error.message);
      return;
    }

    try {
      if (editing.id) {
        await api.customField.updateDefinition.mutate({
          id: editing.id,
          ...payload,
        });
        toast.success('Custom field updated');
      } else {
        await api.customField.createDefinition.mutate(payload);
        toast.success('Custom field created');
      }
      invalidate();
      close();
    } catch (e) {
      toast.error('Failed to save custom field');
      console.error(e);
    }
  };

  $effect(() => {
    if (!open && editing) {
      editing = null;
    }
  });
</script>

<Modal bind:open class="max-w-lg" closeOnOutsideClick={false}>
  {#if editing}
    <ModalBreadcrumbHeader
      section="Custom fields"
      title={editing.id ? 'Edit field' : 'Add field'}
      icon={SlidersHorizontal}
    />
    <ModalBody>
      <div class="grid gap-4">
        <div class="grid gap-1">
          <label class="text-sm font-medium" for="custom-field-label"
            >Label</label
          >
          <Input
            id="custom-field-label"
            value={editing.label}
            oninput={(e) => onLabelInput(e.currentTarget.value)}
            placeholder="e.g. Booking reference"
          />
        </div>

        <div class="grid gap-1">
          <label class="text-sm font-medium" for="custom-field-key">Key</label>
          <Input
            id="custom-field-key"
            value={editing.key}
            oninput={(e) => onKeyInput(e.currentTarget.value)}
            placeholder="e.g. booking_reference"
          />
        </div>

        <div class="grid gap-1">
          <label class="text-sm font-medium" for="custom-field-type-trigger"
            >Type</label
          >
          <Select.Root
            type="single"
            value={editing.fieldType}
            onValueChange={(v) => {
              if (!editing) return;

              const nextType = (v as FieldType) ?? 'text';
              editing.fieldType = nextType;

              if (nextType !== 'select') {
                editing.defaultSelect = '';
              }
            }}
          >
            <Select.Trigger id="custom-field-type-trigger"
              >{FIELD_TYPE_LABELS[editing.fieldType]}</Select.Trigger
            >
            <Select.Content>
              <Select.Item value="text" label="Short text" />
              <Select.Item value="textarea" label="Long text" />
              <Select.Item value="number" label="Number" />
              <Select.Item value="boolean" label="Boolean" />
              <Select.Item value="date" label="Date" />
              <Select.Item value="select" label="Select" />
            </Select.Content>
          </Select.Root>
        </div>

        {#if isTextLike(editing.fieldType)}
          <div class="grid gap-1">
            <label
              class="text-sm font-medium flex items-center gap-1"
              for="custom-field-validation-regex"
            >
              Regex
              <HelpTooltip
                text="Optional JavaScript-style regex pattern used to validate text values."
              />
            </label>
            <Input
              id="custom-field-validation-regex"
              bind:value={editing.validationRegex}
              placeholder="e.g. ^[A-Z]{2}-\\d{4}$"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1">
              <label class="text-sm font-medium" for="custom-field-min-length"
                >Min length</label
              >
              <Input
                id="custom-field-min-length"
                type="number"
                bind:value={editing.validationMinLength}
              />
            </div>
            <div class="grid gap-1">
              <label class="text-sm font-medium" for="custom-field-max-length"
                >Max length</label
              >
              <Input
                id="custom-field-max-length"
                type="number"
                bind:value={editing.validationMaxLength}
              />
            </div>
          </div>
        {:else if editing.fieldType === 'number'}
          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1">
              <label class="text-sm font-medium" for="custom-field-min-value"
                >Min value</label
              >
              <Input
                id="custom-field-min-value"
                type="number"
                bind:value={editing.validationMin}
              />
            </div>
            <div class="grid gap-1">
              <label class="text-sm font-medium" for="custom-field-max-value"
                >Max value</label
              >
              <Input
                id="custom-field-max-value"
                type="number"
                bind:value={editing.validationMax}
              />
            </div>
          </div>
        {/if}

        {#if editing.fieldType === 'select'}
          <div class="grid gap-1">
            <label class="text-sm font-medium" for="custom-field-options"
              >Options (one per line)</label
            >
            <textarea
              id="custom-field-options"
              class="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
              bind:value={editing.optionsText}
              placeholder={'Economy\nBusiness\nFirst'}
            ></textarea>
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-3">
          <div class="flex items-center gap-2">
            <Switch
              id="custom-field-required"
              bind:checked={editing.required}
            />
            <label class="text-sm font-normal" for="custom-field-required"
              >Required</label
            >
          </div>
          <div class="flex items-center gap-2">
            <Switch id="custom-field-active" bind:checked={editing.active} />
            <label class="text-sm font-normal" for="custom-field-active"
              >Active</label
            >
          </div>
        </div>

        <div class="grid gap-1">
          <label class="text-sm font-medium" for="custom-field-description"
            >Description</label
          >
          <Input
            id="custom-field-description"
            bind:value={editing.description}
            placeholder="Optional helper text"
          />
        </div>

        <!-- Preview / default value -->
        <div class="grid gap-2">
          <p class="text-sm font-medium">Preview</p>
          <p class="text-muted-foreground text-xs">
            This is how the field will appear. The value you enter here becomes
            the default.
          </p>
          <div class="rounded-md border border-dashed bg-muted/30 p-4">
            <CustomFieldInput
              id="custom-field-preview"
              label={editing.label || 'Untitled field'}
              fieldType={editing.fieldType}
              required={editing.required}
              options={editing.fieldType === 'select'
                ? editing.optionsText
                    .split('\n')
                    .map((x) => x.trim())
                    .filter(Boolean)
                : []}
              description={editing.description}
              value={getPreviewValue(editing)}
              onchange={(val) => setPreviewValue(editing, val)}
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" onclick={close}>Cancel</Button>
          <Button onclick={save}>Save</Button>
        </div>
      </div>
    </ModalBody>
  {/if}
</Modal>
