<script lang="ts">
  import {
    GripVertical,
    Plus,
    SlidersHorizontal,
    SquarePen,
    X,
  } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from './index';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
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
    defaultValueText: string;
    validationRegex: string;
    validationMin: string;
    validationMax: string;
    validationMinLength: string;
    validationMaxLength: string;
  } | null>(null);

  let editModalOpen = $state(false);
  let autoKey = $state(false);
  let draggingId = $state<number | null>(null);

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
      order: 0,
      optionsText: '',
      defaultValueText: '',
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

    editing = {
      id: item.id,
      key: item.key,
      label: item.label,
      description: item.description ?? '',
      fieldType: item.fieldType,
      required: item.required,
      active: item.active,
      order: item.order,
      optionsText: normalizeOptions(item.options).join('\n'),
      defaultValueText:
        item.defaultValue == null ? '' : JSON.stringify(item.defaultValue),
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
    if (editing.defaultValueText.trim()) {
      try {
        defaultValue = JSON.parse(editing.defaultValueText);
      } catch {
        toast.error('Default value must be valid JSON');
        return;
      }
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

    const payload = {
      entityType: 'flight' as const,
      key: editing.key.trim(),
      label: editing.label.trim(),
      description: editing.description.trim() || null,
      fieldType: editing.fieldType,
      required: editing.required,
      active: editing.active,
      order: editing.order,
      options:
        editing.fieldType === 'select'
          ? editing.optionsText
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean)
          : undefined,
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

  const moveField = async (targetId: number) => {
    if (draggingId == null || draggingId === targetId) return;

    const list = [...($definitionsQuery.data ?? [])] as DefinitionItem[];
    const fromIndex = list.findIndex((item) => item.id === draggingId);
    const toIndex = list.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    try {
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
      toast.success('Custom fields reordered');
    } catch (e) {
      toast.error('Failed to reorder custom fields');
      console.error(e);
    } finally {
      draggingId = null;
    }
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
    <div class="space-y-2">
      {#each $definitionsQuery.data as item (item.id)}
        <Card
          level="2"
          class="p-3 flex items-center gap-3"
          ondragover={(e) => e.preventDefault()}
          ondrop={() => moveField(item.id)}
        >
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            draggable="true"
            ondragstart={() => {
              draggingId = item.id;
            }}
            ondragend={() => {
              draggingId = null;
            }}
            aria-label="Drag to reorder"
          >
            <GripVertical size={16} />
          </button>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium truncate">{item.label}</p>
              <span class="text-xs text-muted-foreground">{item.key}</span>
              {#if !item.active}
                <span class="text-xs text-muted-foreground">(inactive)</span>
              {/if}
            </div>
            <p class="text-sm text-muted-foreground">
              {toTitleCase(item.fieldType)}{item.required ? ' • Required' : ''}
            </p>
          </div>
          <Button variant="outline" size="icon" onclick={() => openEdit(item)}>
            <SquarePen size={14} />
          </Button>
          <Button variant="outline" size="icon" onclick={() => remove(item.id)}>
            <X size={14} />
          </Button>
        </Card>
      {/each}
    </div>
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
        <label class="text-sm font-medium">Label</label>
        <Input
          value={editing.label}
          oninput={(e) => onLabelInput(e.currentTarget.value)}
          placeholder="e.g. Booking reference"
        />

        <label class="text-sm font-medium">Key</label>
        <Input
          value={editing.key}
          oninput={(e) => onKeyInput(e.currentTarget.value)}
          placeholder="e.g. booking_reference"
        />

        <label class="text-sm font-medium">Type</label>
        <Select.Root
          type="single"
          value={editing.fieldType}
          onValueChange={(v) =>
            (editing!.fieldType = (v as FieldType) ?? 'text')}
        >
          <Select.Trigger>{toTitleCase(editing.fieldType)}</Select.Trigger>
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
            <label class="text-sm font-medium flex items-center gap-1">
              Regex
              <HelpTooltip
                side="right"
                content="Optional JavaScript-style regex pattern used to validate text values."
              />
            </label>
            <Input
              bind:value={editing.validationRegex}
              placeholder="e.g. ^[A-Z]{2}-\\d{4}$"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-sm font-medium">Min length</label>
              <Input type="number" bind:value={editing.validationMinLength} />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium">Max length</label>
              <Input type="number" bind:value={editing.validationMaxLength} />
            </div>
          </div>
        {:else if editing.fieldType === 'number'}
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-sm font-medium">Min value</label>
              <Input type="number" bind:value={editing.validationMin} />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium">Max value</label>
              <Input type="number" bind:value={editing.validationMax} />
            </div>
          </div>
        {/if}

        {#if editing.fieldType === 'select'}
          <label class="text-sm font-medium">Options (one per line)</label>
          <textarea
            class="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
            bind:value={editing.optionsText}
            placeholder={'Economy\nBusiness\nFirst'}
          ></textarea>
        {/if}

        <label class="text-sm font-medium">Default value (JSON)</label>
        <Input
          bind:value={editing.defaultValueText}
          placeholder={'e.g. "ABC123" or 42 or true'}
        />

        <div class="grid grid-cols-2 gap-3">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={editing.required} /> Required
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={editing.active} /> Active
          </label>
        </div>

        <label class="text-sm font-medium">Order</label>
        <Input type="number" bind:value={editing.order} />

        <label class="text-sm font-medium">Description</label>
        <Input
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
