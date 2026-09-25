<script lang="ts" generics="T">
  import type { AccessRow } from '$lib/authorization/access-presentation';
  import { Checkbox } from '$lib/components/ui/checkbox';
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
        <label
          class="inline-flex h-7 items-center gap-2 whitespace-nowrap text-xs text-foreground has-disabled:cursor-not-allowed has-disabled:text-muted-foreground"
          title={state.title}
        >
          <Checkbox
            bind:checked={() => state.checked, () => onToggle(row, action)}
            indeterminate={state.indeterminate}
            disabled={state.disabled}
            class={cn(
              state.inherited &&
                'border-muted-foreground data-[state=checked]:bg-muted-foreground',
            )}
          />
          {action.action === 'read' ? 'Read' : 'Write'}
        </label>
      {/each}
    </div>
  </div>
{/each}
