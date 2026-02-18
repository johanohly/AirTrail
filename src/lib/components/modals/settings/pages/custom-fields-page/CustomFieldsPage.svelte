<script lang="ts">
  import { GripVertical, Plus, SquarePen, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CustomFieldEditModal from './CustomFieldEditModal.svelte';
  import CustomFieldRow from './CustomFieldRow.svelte';
  import type { DefinitionItem } from './types';
  import { PageHeader } from '../index';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import {
    DragDropProvider,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
  } from '@dnd-kit-svelte/svelte';
  import { api, trpc } from '$lib/trpc';
  import { toTitleCase } from '$lib/utils';

  const definitionsQuery = trpc.customField.listDefinitions.query({
    entityType: 'flight',
    includeInactive: true,
  });

  const sortableGroupId = 'custom-fields';
  let activeDragId = $state<number | null>(null);
  let editModal = $state<ReturnType<typeof CustomFieldEditModal>>();
  let editModalOpen = $state(false);

  const activeDragItem = $derived(
    ($definitionsQuery.data ?? []).find((item) => item.id === activeDragId),
  );

  const invalidate = () => {
    trpc.customField.listDefinitions.utils.invalidate({
      entityType: 'flight',
      includeInactive: true,
    });
  };

  const onDragStart = (event: any) => {
    const id = Number(event?.operation?.source?.id);
    activeDragId = Number.isFinite(id) ? id : null;
  };

  const onDragEnd = async (event: any) => {
    const fromId = Number(event?.operation?.source?.id);
    const targetId = Number(event?.operation?.target?.id);

    activeDragId = null;

    if (
      !Number.isFinite(fromId) ||
      !Number.isFinite(targetId) ||
      fromId === targetId
    ) {
      return;
    }

    const list = [...($definitionsQuery.data ?? [])] as DefinitionItem[];
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    try {
      await api.customField.reorderDefinitions.mutate({
        entityType: 'flight',
        orderedIds: list.map((item) => item.id),
      });
      invalidate();
      toast.success('Custom fields reordered');
    } catch (e) {
      toast.error('Failed to reorder custom fields');
      console.error(e);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.customField.deleteDefinition.mutate(id);
      invalidate();
      toast.success('Custom field removed');
    } catch (e) {
      toast.error('Failed to delete custom field');
      console.error(e);
    }
  };

  const openEdit = (item: DefinitionItem) => {
    editModal?.openEdit(item);
  };
</script>

<PageHeader
  title="Custom fields"
  subtitle="Define optional structured fields for flight records."
>
  {#snippet headerRight()}
    <Button onclick={() => editModal?.openCreate()}>
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
            onEdit={() => openEdit(item)}
            onRemove={remove}
          />
        {/each}
      </div>

      <DragOverlay>
        {#if activeDragItem}
          <Card
            level="2"
            class="w-full p-3 flex items-center gap-3 border border-border bg-card shadow-xs"
          >
            <div class="text-muted-foreground">
              <GripVertical size={16} />
            </div>

            <div class="flex-1 min-w-0">
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
            </div>

            <Button variant="outline" size="icon" disabled>
              <SquarePen size={14} />
            </Button>
            <Button variant="outline" size="icon" disabled>
              <X size={14} />
            </Button>
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

<CustomFieldEditModal
  bind:this={editModal}
  bind:open={editModalOpen}
  definitionCount={$definitionsQuery.data?.length ?? 0}
/>
