<script lang="ts">
  import { GripVertical, SquarePen, X } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { useSortable } from '@dnd-kit-svelte/svelte/sortable';

  import { FIELD_TYPE_LABELS, type DefinitionItem } from './types';

  let {
    item,
    index,
    group,
    onEdit,
    onRemove,
  }: {
    item: DefinitionItem;
    index: number;
    group: string;
    onEdit: (item: DefinitionItem) => void;
    onRemove: (id: number) => void;
  } = $props();

  const sortable = useSortable({
    id: item.id,
    index,
    group,
    type: 'custom-field',
  });
</script>

<Card
  level="2"
  class="w-full p-3 flex items-center gap-3 border border-border bg-card"
  {@attach sortable.ref}
  {@attach sortable.sourceRef}
  {@attach sortable.targetRef}
>
  <button
    type="button"
    class="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
    aria-label="Drag to reorder"
    {@attach sortable.handleRef}
  >
    <GripVertical size={16} />
  </button>

  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-2">
      <p class="font-medium truncate">{item.label}</p>
      {#if !item.active}
        <span class="text-xs text-muted-foreground">(inactive)</span>
      {/if}
    </div>
    <p class="text-sm text-muted-foreground">
      {FIELD_TYPE_LABELS[item.fieldType]}{item.required ? ' • Required' : ''}
    </p>
  </div>
  <Button variant="outline" size="icon" onclick={() => onEdit(item)}>
    <SquarePen size={14} />
  </Button>
  <Button
    variant="outline"
    size="icon"
    class="shrink-0"
    onclick={() => onRemove(item.id)}
  >
    <X size={14} class="shrink-0" />
  </Button>
</Card>
