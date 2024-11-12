<script lang="ts">
  import { LoaderCircle, House, Gift, Plane } from '@o7/icon/lucide';
  import { Tour } from '@o7/icon/material';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label';
  import { Modal } from '$lib/components/ui/modal';
  import type { VisitedCountryStatus } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import { type Country, countryFromNumeric } from '$lib/utils/data/countries';

  let {
    open = $bindable(),
    editingInfo,
  }: {
    open: boolean;
    editingInfo: {
      id: number;
      status: (typeof VisitedCountryStatus)[number] | null;
      note: string | null;
    } | null;
  } = $props();

  let countryData: Country | undefined = $state(undefined);
  let status: (typeof VisitedCountryStatus)[number] | null = $state(null);
  let note: string = $state('');
  $effect(() => {
    if (!editingInfo) {
      status = null;
      note = '';
      return;
    }

    countryData = countryFromNumeric(+editingInfo.id);
    status = editingInfo?.status;
    note = editingInfo.note ?? '';
  });

  let loading = $state(false);
  const save = async () => {
    if (!countryData) return;

    loading = true;
    const success = await api.visitedCountries.save.mutate({
      code: countryData.numeric,
      status,
      note: note ?? undefined,
    });
    if (success) {
      await trpc.visitedCountries.list.utils.invalidate();
      open = false;
    } else {
      toast.error('Failed to save');
    }
    loading = false;
  };
</script>

<Modal bind:open>
  <h2 class="text-lg font-bold max-md:mb-2">{countryData?.name}</h2>
  <div class="grid grid-cols-2 gap-2">
    {@render statusRadioItem('visited', 'Visited')}
    {@render statusRadioItem('lived', 'Lived')}
    {@render statusRadioItem('wishlist', 'Wishlist')}
    {@render statusRadioItem('layover', 'Layover')}
  </div>
  <Textarea
    bind:value={note}
    placeholder="Note"
    class="resize-y h-20 min-h-10 max-h-64 w-full mt-2"
  />
  <Button
    onclick={save}
    disabled={(editingInfo?.status === status && editingInfo?.note === note) ||
      (!status && !editingInfo?.status) ||
      loading}
  >
    {#if loading}
      <LoaderCircle size={16} class="animate-spin mr-2" />
    {/if}
    Save
  </Button>
</Modal>

{#snippet statusRadioItem(value, label)}
  <Label
    onclick={() => {
      if (status === value) {
        status = null;
      } else {
        status = value;
      }
    }}
    class={cn('w-full cursor-pointer', {
      '[&>div]:border-primary': value === status,
    })}
  >
    <div
      class="border-muted bg-popover hover:bg-accent items-center rounded-md border-2 p-4"
    >
      <div class="flex items-center justify-center gap-1">
        {#if value === 'lived'}
          <House class="w-6 h-6" />
        {:else if value === 'visited'}
          <Tour class="w-6 h-6" />
        {:else if value === 'wishlist'}
          <Gift class="w-6 h-6" />
        {:else if value === 'layover'}
          <Plane class="w-6 h-6" />
        {/if}
        <span class="text-2xl font-bold">{label}</span>
      </div>
    </div>
  </Label>
{/snippet}
