<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { trpc } from '$lib/trpc/index.js';
  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Select } from '$lib/components/ui/select';
  import { Separator } from '$lib/components/ui/separator';
  import { Trash2, Copy, SquarePen, Plus, ExternalLink } from '@o7/icon/lucide';
  import { generateRandomString } from '$lib/utils/string';

  let {
    open = $bindable(),
  }: {
    open: boolean;
  } = $props();

  interface Share {
    id: number;
    slug: string;
    expiresAt?: Date;
    createdAt: Date;
    showMap: boolean;
    showStats: boolean;
    showFlightList: boolean;
    dateFrom?: string;
    dateTo?: string;
    showFlightNumbers: boolean;
    showAirlines: boolean;
    showAircraft: boolean;
    showTimes: boolean;
    showDates: boolean;
  }

  let mode: 'list' | 'create' | 'edit' = $state('list');
  let editingShare: Share | null = $state(null);

  // Form state
  let shareForm = $state({
    slug: '',
    expiresAt: null as Date | null,
    expiryOption: 'never' as
      | 'never'
      | '1day'
      | '1week'
      | '1month'
      | '3months'
      | 'custom',
    showMap: true,
    showStats: false,
    showFlightList: false,
    dateFrom: '',
    dateTo: '',
    showFlightNumbers: true,
    showAirlines: true,
    showAircraft: false,
    showTimes: false,
    showDates: true,
  });

  // Reset form
  function resetForm() {
    shareForm.slug = generateRandomString(12);
    shareForm.expiresAt = null;
    shareForm.expiryOption = 'never';
    shareForm.showMap = true;
    shareForm.showStats = false;
    shareForm.showFlightList = false;
    shareForm.dateFrom = '';
    shareForm.dateTo = '';
    shareForm.showFlightNumbers = true;
    shareForm.showAirlines = true;
    shareForm.showAircraft = false;
    shareForm.showTimes = false;
    shareForm.showDates = true;
  }

  // tRPC queries and mutations
  const sharesQuery = trpc.share.list.query();

  const invalidator = {
    onSuccess: () => {
      trpc.share.list.utils.invalidate();
    },
  };

  const createShareMutation = trpc.share.create.mutation(invalidator);
  const updateShareMutation = trpc.share.update.mutation(invalidator);
  const deleteShareMutation = trpc.share.delete.mutation(invalidator);

  // Handle expiry option change
  function updateExpiryDate() {
    const now = new Date();
    switch (shareForm.expiryOption) {
      case 'never':
        shareForm.expiresAt = null;
        break;
      case '1day':
        shareForm.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '1week':
        shareForm.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '1month':
        shareForm.expiresAt = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
        break;
      case '3months':
        shareForm.expiresAt = new Date(
          now.getTime() + 90 * 24 * 60 * 60 * 1000,
        );
        break;
    }
  }

  // Create or update share
  async function saveShare() {
    try {
      const shareData = {
        slug: shareForm.slug,
        expiresAt: shareForm.expiresAt,
        showMap: shareForm.showMap,
        showStats: shareForm.showStats,
        showFlightList: shareForm.showFlightList,
        dateFrom: shareForm.dateFrom || undefined,
        dateTo: shareForm.dateTo || undefined,
        showFlightNumbers: shareForm.showFlightNumbers,
        showAirlines: shareForm.showAirlines,
        showAircraft: shareForm.showAircraft,
        showTimes: shareForm.showTimes,
        showDates: shareForm.showDates,
      };

      if (mode === 'create') {
        await $createShareMutation.mutateAsync(shareData);
        toast.success('Share created successfully');
      } else if (mode === 'edit' && editingShare) {
        await $updateShareMutation.mutateAsync({
          id: editingShare.id,
          ...shareData,
        });
        toast.success('Share updated successfully');
      }

      mode = 'list';
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save share';
      toast.error(errorMessage);
    }
  }

  // Delete share
  async function deleteShare(shareId: number) {
    if (!confirm('Are you sure you want to delete this share?')) return;

    try {
      await $deleteShareMutation.mutateAsync(shareId.toString());
      toast.success('Share deleted successfully');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete share';
      toast.error(errorMessage);
    }
  }

  // Edit share
  function editShare(share: Share) {
    editingShare = share;
    shareForm.slug = share.slug;
    shareForm.expiresAt = share.expiresAt ? new Date(share.expiresAt) : null;
    shareForm.expiryOption = share.expiresAt ? 'custom' : 'never';
    shareForm.showMap = share.showMap;
    shareForm.showStats = share.showStats;
    shareForm.showFlightList = share.showFlightList;
    shareForm.dateFrom = share.dateFrom || '';
    shareForm.dateTo = share.dateTo || '';
    shareForm.showFlightNumbers = share.showFlightNumbers;
    shareForm.showAirlines = share.showAirlines;
    shareForm.showAircraft = share.showAircraft;
    shareForm.showTimes = share.showTimes;
    shareForm.showDates = share.showDates;
    mode = 'edit';
  }

  // Copy share URL to clipboard
  async function copyShareUrl(slug: string) {
    const url = `${window.location.origin}/share/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share URL copied to clipboard');
    } catch {
      toast.error('Failed to copy URL');
    }
  }

  // Generate new random slug
  function generateNewSlug() {
    shareForm.slug = generateRandomString(12);
  }

  // Reset modal state when closed
  $effect(() => {
    if (!open) {
      mode = 'list';
      editingShare = null;
      resetForm();
    }
  });

  onMount(() => {
    resetForm();
  });
</script>

<Modal bind:open class="max-w-2xl">
  <div class="space-y-6">
    {#if mode === 'list'}
      <!-- List shares -->
      <div class="space-y-0.5">
        <h2 class="text-2xl font-bold tracking-tight">Share Management</h2>
        <p class="text-muted-foreground">
          Create and manage public shares of your flight data.
        </p>
      </div>
      <Separator />

      <div class="space-y-4">
        <Button
          onclick={() => {
            resetForm();
            mode = 'create';
          }}
          class="w-full"
        >
          <Plus class="w-4 h-4 mr-2" />
          Create New Share
        </Button>

        {#if $sharesQuery.isLoading}
          <p class="text-center text-muted-foreground">Loading shares...</p>
        {:else if $sharesQuery.error}
          <p class="text-center text-destructive">
            Error loading shares: {$sharesQuery.error.message}
          </p>
        {:else if !$sharesQuery.data || $sharesQuery.data.length === 0}
          <p class="text-center text-muted-foreground">
            No shares created yet.
          </p>
        {:else}
          <div class="space-y-3">
            {#each $sharesQuery.data as share (share.id)}
              <div class="border rounded-lg p-4 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <p class="font-medium">/{share.slug}</p>
                    <p class="text-sm text-muted-foreground">
                      Created: {new Date(share.createdAt).toLocaleDateString()}
                      {#if share.expiresAt}
                        • Expires: {new Date(
                          share.expiresAt,
                        ).toLocaleDateString()}
                      {:else}
                        • Never expires
                      {/if}
                    </p>
                    <div class="flex gap-2 text-xs">
                      {#if share.showMap}<span
                          class="bg-primary/10 text-primary px-2 py-1 rounded"
                          >Map</span
                        >{/if}
                      {#if share.showStats}<span
                          class="bg-primary/10 text-primary px-2 py-1 rounded"
                          >Stats</span
                        >{/if}
                      {#if share.showFlightList}<span
                          class="bg-primary/10 text-primary px-2 py-1 rounded"
                          >Flights</span
                        >{/if}
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => copyShareUrl(share.slug)}
                    >
                      <Copy class="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() =>
                        window.open(`/share/${share.slug}`, '_blank')}
                    >
                      <ExternalLink class="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => editShare(share)}
                    >
                      <SquarePen class="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => deleteShare(share.id)}
                    >
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if mode === 'create' || mode === 'edit'}
      <!-- Create/Edit form -->
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" onclick={() => (mode = 'list')}
            >←</Button
          >
          <h2 class="text-2xl font-bold tracking-tight">
            {mode === 'create' ? 'Create' : 'Edit'} Share
          </h2>
        </div>
        <p class="text-muted-foreground">
          Configure your share settings and privacy options.
        </p>
      </div>
      <Separator />

      <form onsubmit={saveShare} class="space-y-6">
        <!-- Share URL -->
        <div class="space-y-2">
          <Label>Share URL</Label>
          <div class="flex gap-2">
            <div class="flex-1 flex">
              <span
                class="inline-flex items-center px-3 text-sm bg-muted border border-r-0 rounded-l-md"
              >
                /share/
              </span>
              <Input
                bind:value={shareForm.slug}
                placeholder="custom-url-slug"
                class="rounded-l-none"
                required
              />
            </div>
            <Button type="button" variant="outline" onclick={generateNewSlug}>
              Generate
            </Button>
          </div>
        </div>

        <!-- Expiry -->
        <div class="space-y-3">
          <Label>Share Duration</Label>
          <Select
            bind:value={shareForm.expiryOption}
            onValueChange={updateExpiryDate}
          >
            <option value="never">Never expires</option>
            <option value="1day">1 day</option>
            <option value="1week">1 week</option>
            <option value="1month">1 month</option>
            <option value="3months">3 months</option>
            <option value="custom">Custom date</option>
          </Select>
          {#if shareForm.expiryOption === 'custom'}
            <Input type="datetime-local" bind:value={shareForm.expiresAt} />
          {/if}
        </div>

        <!-- Content Visibility -->
        <div class="space-y-3">
          <Label>Content Visibility</Label>
          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showMap} />
              <span>Show Map</span>
            </label>
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showStats} />
              <span>Show Statistics</span>
            </label>
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showFlightList} />
              <span>Show Flight List</span>
            </label>
          </div>
        </div>

        <!-- Date Range Filter -->
        <div class="space-y-3">
          <Label>Date Range (Optional)</Label>
          <div class="flex gap-2">
            <div class="space-y-1">
              <Label class="text-sm">From</Label>
              <Input
                type="date"
                bind:value={shareForm.dateFrom}
                placeholder="From date"
              />
            </div>
            <div class="space-y-1">
              <Label class="text-sm">To</Label>
              <Input
                type="date"
                bind:value={shareForm.dateTo}
                placeholder="To date"
              />
            </div>
          </div>
        </div>

        <!-- Data Privacy -->
        <div class="space-y-3">
          <Label>Data Privacy</Label>
          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showFlightNumbers} />
              <span>Show Flight Numbers</span>
            </label>
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showAirlines} />
              <span>Show Airlines</span>
            </label>
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showAircraft} />
              <span>Show Aircraft Types</span>
            </label>
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showTimes} />
              <span>Show Flight Times</span>
            </label>
            <label class="flex items-center space-x-2">
              <Checkbox bind:checked={shareForm.showDates} />
              <span>Show Flight Dates</span>
            </label>
          </div>
        </div>

        <div class="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onclick={() => (mode = 'list')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={$createShareMutation.isPending ||
              $updateShareMutation.isPending}
            class="flex-1"
          >
            {mode === 'create' ? 'Create Share' : 'Update Share'}
          </Button>
        </div>
      </form>
    {/if}
  </div>
</Modal>
