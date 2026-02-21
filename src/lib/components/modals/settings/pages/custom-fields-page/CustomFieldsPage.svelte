<script lang="ts">
  import {
    DragDropProvider,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
  } from '@dnd-kit-svelte/svelte';
  import { isSortable } from '@dnd-kit-svelte/svelte/sortable';
  import { GripVertical, Plus, SquarePen, Trash2 } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';

  import CustomFieldEditModal from './CustomFieldEditModal.svelte';
  import CustomFieldRow from './CustomFieldRow.svelte';
  import { FIELD_TYPE_LABELS, type DefinitionItem } from './types';

  import { confirmation } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { api, trpc } from '$lib/trpc';

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
    activeDragId = null;

    const { source } = event.operation;
    if (event.canceled || !source || !isSortable(source)) return;

    const fromIndex = source.sortable.initialIndex;
    const toIndex = source.sortable.index;
    if (fromIndex === toIndex) return;

    const list = [...($definitionsQuery.data ?? [])] as DefinitionItem[];
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
    const confirmed = await confirmation.show({
      title: 'Remove custom field',
      description:
        'Are you sure you want to remove this custom field? Any existing values will be deleted.',
    });
    if (!confirmed) return;

    try {
      await api.customField.deleteDefinition.mutate({
        id,
        entityType: 'flight',
      });
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
  title="Custom Fields"
  subtitle="Define optional structured fields for flight records."
>
  {#snippet headerRight()}
    <Button onclick={() => editModal?.openCreate()}>
      <Plus size={16} class="mr-1 shrink-0" />
      Add
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
                {FIELD_TYPE_LABELS[
                  activeDragItem.fieldType
                ]}{activeDragItem.required ? ' • Required' : ''}
              </p>
            </div>

            <Button variant="outline" size="icon" disabled>
              <SquarePen size={16} />
            </Button>
            <Button variant="outline" size="icon" disabled>
              <Trash2 size={16} />
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
