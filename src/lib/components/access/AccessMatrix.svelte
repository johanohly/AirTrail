<script lang="ts" generics="T">
  import AccessCheckbox from '$lib/components/access/AccessCheckbox.svelte';
  import type { AccessRow } from '$lib/authorization/access-presentation';
  import { cn } from '$lib/utils';

  type Action = AccessRow<T>['actions'][number];

  /*
   * The read/write grid shared by the role editor and the scope picker. The two
   * differ in what a cell *means* -- inherited permissions versus scopes locked
   * by a write grant -- so each passes its own `cellState`, but the markup and
   * the labelling live here instead of being kept in sync by hand.
   */
  let {
    rows,
    rowClass = '',
    cellState,
    onToggle,
  }: {
    rows: AccessRow<T>[];
    rowClass?: string;
    cellState: (
      row: AccessRow<T>,
      action: Action,
    ) => {
      checked: boolean;
      indeterminate: boolean;
      inherited: boolean;
      disabled: boolean;
      title: string;
    };
    onToggle: (row: AccessRow<T>, action: Action) => void;
  } = $props();
</script>

{#each rows as row (row.key)}
  <div
    class={cn(
      'grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-2',
      rowClass,
    )}
  >
    <span class="min-w-0 truncate text-sm text-foreground">{row.label}</span>
    <div
      class="inline-flex h-7 shrink-0 gap-3 rounded-md border bg-muted/30 px-1.5"
      aria-label={`${row.label} access`}
    >
      {#each row.actions as action (action.action)}
        {@const state = cellState(row, action)}
        <AccessCheckbox
          checked={state.checked}
          indeterminate={state.indeterminate}
          inherited={state.inherited}
          disabled={state.disabled}
          label={action.action === 'read' ? 'Read' : 'Write'}
          title={state.title}
          onclick={() => onToggle(row, action)}
        />
      {/each}
    </div>
  </div>
{/each}
