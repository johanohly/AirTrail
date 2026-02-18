<script lang="ts">
  import { Plus, SlidersHorizontal } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CustomFieldRow from './CustomFieldRow.svelte';
  import { PageHeader } from './index';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import {
    DragDropProvider,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
  } from '@dnd-kit-svelte/svelte';
  // useSortable moved into CustomFieldRow.svelte
  import * as Select from '$lib/components/ui/select';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { api, trpc } from '$lib/trpc';
  import { toTitleCase } from '$lib/utils';

  const definitionsQuery = trpc.customField.listDefinitions.query({
    entityType: 'flight',
    includeInactive: true,
  });

  type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select';

  type DefinitionItem = {
    id: number;
    entityType: 'flight';
    key: string;
    label: string;
    description: string | null;
    fieldType: FieldType;
    required: boolean;
    active: boolean;
    order: number;
    options: unknown;
    defaultValue: unknown;
    validationJson: unknown;
  };

  type Validation = {
    regex?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };

  let editing = $state<{
    id?: number;
    key: string;
    label: string;
    description: string;
    fieldType: FieldType;
    required: boolean;
    active: boolean;
    order: number;
    optionsText: string;
    defaultText: string;
    defaultNumber: string;
    defaultBoolean: boolean;
    defaultDate: string;
    defaultSelect: string;
    validationRegex: string;
    validationMin: string;
    validationMax: string;
    validationMinLength: string;
    validationMaxLength: string;
  } | null>(null);

  let editModalOpen = $state(false);
  let autoKey = $state(false);
  const sortableGroupId = 'custom-fields';
  let activeDragId = $state<number | null>(null);

  const activeDragItem = $derived(
    ($definitionsQuery.data ?? []).find((item) => item.id === activeDragId),
  );

  const parseValidation = (value: unknown): Validation => {
    if (!value || typeof value !== 'object') return {};

    const v = value as Record<string, unknown>;
    return {
      regex: typeof v.regex === 'string' ? v.regex : undefined,
      min: typeof v.min === 'number' ? v.min : undefined,
      max: typeof v.max === 'number' ? v.max : undefined,
      minLength: typeof v.minLength === 'number' ? v.minLength : undefined,
      maxLength: typeof v.maxLength === 'number' ? v.maxLength : undefined,
    };
  };

  const normalizeOptions = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string')
      : [];

  const toKey = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

  const openCreate = () => {
    editing = {
      key: '',
      label: '',
      description: '',
      fieldType: 'text',
      required: false,
      active: true,
      order: $definitionsQuery.data?.length ?? 0,
      optionsText: '',
      defaultText: '',
      defaultNumber: '',
      defaultBoolean: false,
      defaultDate: '',
      defaultSelect: '',
      validationRegex: '',
      validationMin: '',
      validationMax: '',
      validationMinLength: '',
      validationMaxLength: '',
    };
    autoKey = true;
    editModalOpen = true;
  };

  const openEdit = (item: DefinitionItem) => {
    const validation = parseValidation(item.validationJson);

    const options = normalizeOptions(item.options);

    editing = {
      id: item.id,
      key: item.key,
      label: item.label,
      description: item.description ?? '',
      fieldType: item.fieldType,
      required: item.required,
      active: item.active,
      order: item.order,
      optionsText: options.join('\n'),
      defaultText:
        typeof item.defaultValue === 'string' && item.fieldType === 'text'
          ? item.defaultValue
          : '',
      defaultNumber:
        typeof item.defaultValue === 'number' && item.fieldType === 'number'
          ? String(item.defaultValue)
          : '',
      defaultBoolean:
        typeof item.defaultValue === 'boolean' && item.fieldType === 'boolean'
          ? item.defaultValue
          : false,
      defaultDate:
        typeof item.defaultValue === 'string' && item.fieldType === 'date'
          ? item.defaultValue
          : '',
      defaultSelect:
        typeof item.defaultValue === 'string' &&
        item.fieldType === 'select' &&
        options.includes(item.defaultValue)
          ? item.defaultValue
          : '',
      validationRegex: validation.regex ?? '',
      validationMin:
        typeof validation.min === 'number' ? String(validation.min) : '',
      validationMax:
        typeof validation.max === 'number' ? String(validation.max) : '',
      validationMinLength:
        typeof validation.minLength === 'number'
          ? String(validation.minLength)
          : '',
      validationMaxLength:
        typeof validation.maxLength === 'number'
          ? String(validation.maxLength)
          : '',
    };
    autoKey = false;
    editModalOpen = true;
  };

  const closeModal = () => {
    editModalOpen = false;
    editing = null;
    autoKey = false;
  };

  const getDefaultValue = () => {
    if (!editing) return null;

    if (editing.fieldType === 'text') {
      return editing.defaultText.trim() || null;
    }

    if (editing.fieldType === 'number') {
      if (!editing.defaultNumber.trim()) return null;
      const parsed = Number(editing.defaultNumber);
      if (Number.isNaN(parsed)) {
        throw new Error('Default value must be a valid number');
      }
      return parsed;
    }

    if (editing.fieldType === 'boolean') {
      return editing.defaultBoolean;
    }

    if (editing.fieldType === 'date') {
      return editing.defaultDate || null;
    }

    if (editing.fieldType === 'select') {
      return editing.defaultSelect || null;
    }

    return null;
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

  const save = async () => {
    if (!editing) return;

    let defaultValue: unknown = null;
    try {
      defaultValue = getDefaultValue();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid default value');
      return;
    }

    const validationJson: Validation = {};

    if (editing.fieldType === 'text') {
      if (editing.validationRegex.trim()) {
        validationJson.regex = editing.validationRegex.trim();
      }

      if (editing.validationMinLength.trim()) {
        validationJson.minLength = Number(editing.validationMinLength);
      }
      if (editing.validationMaxLength.trim()) {
        validationJson.maxLength = Number(editing.validationMaxLength);
      }
    }

    if (editing.fieldType === 'number') {
      if (editing.validationMin.trim()) {
        validationJson.min = Number(editing.validationMin);
      }
      if (editing.validationMax.trim()) {
        validationJson.max = Number(editing.validationMax);
      }
    }

    if (
      typeof validationJson.min === 'number' &&
      typeof validationJson.max === 'number' &&
      validationJson.min > validationJson.max
    ) {
      toast.error('Min value cannot be greater than max value');
      return;
    }

    if (
      typeof validationJson.minLength === 'number' &&
      typeof validationJson.maxLength === 'number' &&
      validationJson.minLength > validationJson.maxLength
    ) {
      toast.error('Min length cannot be greater than max length');
      return;
    }

    const options =
      editing.fieldType === 'select'
        ? editing.optionsText
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)
        : undefined;

    if (editing.fieldType === 'select' && (!options || options.length === 0)) {
      toast.error('Select fields require at least one option');
      return;
    }

    if (
      editing.fieldType === 'select' &&
      defaultValue != null &&
      typeof defaultValue === 'string' &&
      options &&
      !options.includes(defaultValue)
    ) {
      toast.error('Default option must match one of the listed options');
      return;
    }

    const payload = {
      entityType: 'flight' as const,
      key: editing.key.trim(),
      label: editing.label.trim(),
      description: editing.description.trim() || null,
      fieldType: editing.fieldType,
      required: editing.required,
      active: editing.active,
      order: editing.order,
      options,
      defaultValue,
      validationJson: Object.keys(validationJson).length
        ? validationJson
        : null,
    };

    if (!payload.key || !payload.label) {
      toast.error('Key and label are required');
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
      trpc.customField.listDefinitions.utils.invalidate({
        entityType: 'flight',
        includeInactive: true,
      });
      closeModal();
    } catch (e) {
      toast.error('Failed to save custom field');
      console.error(e);
    }
  };

  $effect(() => {
    if (!editModalOpen && editing) {
      editing = null;
    }
  });

  const toDefinitionPayload = (item: DefinitionItem, order: number) => ({
    entityType: 'flight' as const,
    key: item.key,
    label: item.label,
    description: item.description ?? null,
    fieldType: item.fieldType,
    required: item.required,
    active: item.active,
    order,
    options: normalizeOptions(item.options),
    defaultValue: item.defaultValue ?? null,
    validationJson:
      item.validationJson && typeof item.validationJson === 'object'
        ? item.validationJson
        : null,
  });

  const persistOrder = async (list: DefinitionItem[]) => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const nextOrder = i;
      if (!item || item.order === nextOrder) continue;

      await api.customField.updateDefinition.mutate({
        id: item.id,
        ...toDefinitionPayload(item, nextOrder),
      });
    }

    trpc.customField.listDefinitions.utils.invalidate({
      entityType: 'flight',
      includeInactive: true,
    });
  };

  const moveField = async (fromId: number, targetId: number) => {
    if (fromId === targetId) return;

    const list = [...($definitionsQuery.data ?? [])] as DefinitionItem[];
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    try {
      await persistOrder(list);
      toast.success('Custom fields reordered');
    } catch (e) {
      toast.error('Failed to reorder custom fields');
      console.error(e);
    } finally {
      // no-op
    }
  };

  const onDragStart = (event: any) => {
    const id = Number(event?.operation?.source?.id);
    activeDragId = Number.isFinite(id) ? id : null;
  };

  const onDragEnd = async (event: any) => {
    const fromId = Number(event?.operation?.source?.id);
    const targetId = Number(event?.operation?.target?.id);

    activeDragId = null;

    if (!Number.isFinite(fromId) || !Number.isFinite(targetId)) {
      return;
    }

    await moveField(fromId, targetId);
  };

  const remove = async (id: number) => {
    try {
      await api.customField.deleteDefinition.mutate(id);
      trpc.customField.listDefinitions.utils.invalidate({
        entityType: 'flight',
        includeInactive: true,
      });
      toast.success('Custom field removed');
    } catch (e) {
      toast.error('Failed to delete custom field');
      console.error(e);
    }
  };
</script>

<PageHeader
  title="Custom fields"
  subtitle="Define optional structured fields for flight records."
>
  {#snippet headerRight()}
    <Button onclick={openCreate}>
      <Plus size={14} class="mr-1" />
      Add Field
    </Button>
  {/snippet}

  {#if $definitionsQuery.data?.length}
    <DragDropProvider
      sensors={[PointerSensor, KeyboardSensor]}
      {onDragStart}
      {onDragEnd}
    >
      <div class="space-y-2">
        {#each $definitionsQuery.data as item, index (item.id)}
          <CustomFieldRow
            {item}
            {index}
            group={sortableGroupId}
            onEdit={openEdit}
            onRemove={remove}
          />
        {/each}
      </div>

      <DragOverlay>
        {#if activeDragItem}
          <Card
            level="2"
            class="w-full p-3 border border-border bg-card shadow-xs"
          >
            <div class="flex items-center gap-2">
              <p class="font-medium truncate">{activeDragItem.label}</p>
              {#if !activeDragItem.active}
                <span class="text-xs text-muted-foreground">(inactive)</span>
              {/if}
            </div>
            <p class="text-sm text-muted-foreground">
              {toTitleCase(activeDragItem.fieldType)}{activeDragItem.required
                ? ' • Required'
                : ''}
            </p>
          </Card>
        {/if}
      </DragOverlay>
    </DragDropProvider>
  {:else}
    <Card class="p-6 text-sm text-muted-foreground">
      No custom fields configured yet.
    </Card>
  {/if}
</PageHeader>

<Modal bind:open={editModalOpen} class="max-w-lg" closeOnOutsideClick={false}>
  {#if editing}
    <ModalBreadcrumbHeader
      section="Settings"
      title={editing.id ? 'Edit custom field' : 'Add custom field'}
      icon={SlidersHorizontal}
    />
    <ModalBody>
      <div class="space-y-4">
        <label class="text-sm font-medium" for="custom-field-label">Label</label
        >
        <Input
          id="custom-field-label"
          value={editing.label}
          oninput={(e) => onLabelInput(e.currentTarget.value)}
          placeholder="e.g. Booking reference"
        />

        <label class="text-sm font-medium" for="custom-field-key">Key</label>
        <Input
          id="custom-field-key"
          value={editing.key}
          oninput={(e) => onKeyInput(e.currentTarget.value)}
          placeholder="e.g. booking_reference"
        />

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
            >{toTitleCase(editing.fieldType)}</Select.Trigger
          >
          <Select.Content>
            <Select.Item value="text" label="Text" />
            <Select.Item value="number" label="Number" />
            <Select.Item value="boolean" label="Boolean" />
            <Select.Item value="date" label="Date" />
            <Select.Item value="select" label="Select" />
          </Select.Content>
        </Select.Root>

        {#if editing.fieldType === 'text'}
          <div class="space-y-2">
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
            <div class="space-y-1">
              <label class="text-sm font-medium" for="custom-field-min-length"
                >Min length</label
              >
              <Input
                id="custom-field-min-length"
                type="number"
                bind:value={editing.validationMinLength}
              />
            </div>
            <div class="space-y-1">
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
            <div class="space-y-1">
              <label class="text-sm font-medium" for="custom-field-min-value"
                >Min value</label
              >
              <Input
                id="custom-field-min-value"
                type="number"
                bind:value={editing.validationMin}
              />
            </div>
            <div class="space-y-1">
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
          <label class="text-sm font-medium" for="custom-field-options"
            >Options (one per line)</label
          >
          <textarea
            id="custom-field-options"
            class="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
            bind:value={editing.optionsText}
            placeholder={'Economy\nBusiness\nFirst'}
          ></textarea>
        {/if}

        <p class="text-sm font-medium">Default value</p>
        {#if editing.fieldType === 'text'}
          <Input
            id="custom-field-default-text"
            bind:value={editing.defaultText}
            placeholder="e.g. SK-12345"
          />
        {:else if editing.fieldType === 'number'}
          <Input
            id="custom-field-default-number"
            type="number"
            bind:value={editing.defaultNumber}
            placeholder="e.g. 42"
          />
        {:else if editing.fieldType === 'boolean'}
          <div
            class="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <label class="text-sm" for="custom-field-default-boolean"
              >Enabled by default</label
            >
            <Switch
              id="custom-field-default-boolean"
              bind:checked={editing.defaultBoolean}
            />
          </div>
        {:else if editing.fieldType === 'date'}
          <Input
            id="custom-field-default-date"
            type="date"
            bind:value={editing.defaultDate}
          />
        {:else if editing.fieldType === 'select'}
          {@const selectOptions = editing.optionsText
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)}
          <Select.Root
            type="single"
            value={editing.defaultSelect}
            onValueChange={(v) => (editing!.defaultSelect = v ?? '')}
          >
            <Select.Trigger id="custom-field-default-select">
              {editing.defaultSelect || 'Select default option'}
            </Select.Trigger>
            <Select.Content>
              {#each selectOptions as option (option)}
                <Select.Item value={option} label={option} />
              {/each}
            </Select.Content>
          </Select.Root>
        {/if}

        <div class="grid grid-cols-2 gap-3">
          <div
            class="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <label class="text-sm" for="custom-field-required">Required</label>
            <Switch
              id="custom-field-required"
              bind:checked={editing.required}
            />
          </div>
          <div
            class="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <label class="text-sm" for="custom-field-active">Active</label>
            <Switch id="custom-field-active" bind:checked={editing.active} />
          </div>
        </div>

        <label class="text-sm font-medium" for="custom-field-description"
          >Description</label
        >
        <Input
          id="custom-field-description"
          bind:value={editing.description}
          placeholder="Optional helper text"
        />

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" onclick={closeModal}>Cancel</Button>
          <Button onclick={save}>Save</Button>
        </div>
      </div>
    </ModalBody>
  {/if}
</Modal>
