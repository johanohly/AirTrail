<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { cn } from '$lib/utils';

  import type { MergeChoice, MergeField } from './merge-fields';

  let {
    open = $bindable(false),
    fields,
    applied,
    onResolve,
    onCancel,
  }: {
    open?: boolean;
    /** Conflicting fields the user must resolve. */
    fields: MergeField[];
    /** Fetched values applied automatically because they didn't conflict. */
    applied: MergeField[];
    onResolve: (choices: Record<string, MergeChoice>) => void;
    onCancel: () => void;
  } = $props();

  // Default every conflict to the fetched value. The modal is recreated on each
  // open, so initializing from `fields` here is sufficient.
  let choices = $state<Record<string, MergeChoice>>(
    Object.fromEntries(fields.map((f) => [f.key, 'fetched'])),
  );

  let resolved = $state(false);

  // Closing the modal without applying counts as a cancel.
  $effect(() => {
    if (!open && !resolved) onCancel();
  });

  const setAll = (choice: MergeChoice) => {
    choices = Object.fromEntries(fields.map((f) => [f.key, choice]));
  };

  const apply = () => {
    resolved = true;
    open = false;
    onResolve({ ...choices });
  };
</script>

<Modal bind:open class="max-w-xl" closeOnOutsideClick={false}>
  <ModalHeader class="pb-0">
    <h2 class="text-lg font-medium">Resolve data conflicts</h2>
  </ModalHeader>
  <ModalBody>
    <div class="mb-3 flex items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">
        Some values fetched from AeroDataBox conflict with the current values.
      </p>
      <div class="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onclick={() => setAll('current')}>
          Keep all current
        </Button>
        <Button variant="outline" size="sm" onclick={() => setAll('fetched')}>
          Use all fetched
        </Button>
      </div>
    </div>

    <div class="grid gap-3">
      {#each fields as field (field.key)}
        <fieldset class="rounded-lg border px-3 pb-3 pt-2">
          <legend
            class="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {field.label}
          </legend>
          <div class="grid grid-cols-2 gap-2">
            {#each [{ value: 'current', title: 'Current', display: field.currentDisplay }, { value: 'fetched', title: 'Fetched', display: field.fetchedDisplay }] as option (option.value)}
              {@const selected = choices[field.key] === option.value}
              <button
                type="button"
                aria-pressed={selected}
                onclick={() =>
                  (choices[field.key] = option.value as MergeChoice)}
                class={cn(
                  'flex flex-col rounded-md border px-3 py-2 text-left transition-all',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <span
                  class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {option.title}
                </span>
                <span class="break-words font-medium">
                  {option.display || '—'}
                </span>
              </button>
            {/each}
          </div>
        </fieldset>
      {/each}
    </div>

    {#if applied.length > 0}
      <div class="mt-4 border-t pt-3">
        <p
          class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Also filled in from the lookup
        </p>
        <div class="grid gap-1.5">
          {#each applied as field (field.key)}
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="text-muted-foreground">{field.label}</span>
              <span class="break-words text-right font-medium">
                {field.fetchedDisplay || '—'}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </ModalBody>
  <div class="flex items-center justify-between gap-3 px-6 pb-4">
    <p class="text-xs text-muted-foreground">
      Any values not listed will be left unchanged.
    </p>
    <div class="flex gap-2">
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button onclick={apply}>Apply</Button>
    </div>
  </div>
</Modal>
