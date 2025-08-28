<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { Copy, ExternalLink, Trash2 } from '@o7/icon/lucide';

  import CreateShare from './CreateShare.svelte';
  import EditShare from './EditShare.svelte';

  import { Button } from '$lib/components/ui/button';
  import PageHeader from './PageHeader.svelte';
  import { api, trpc } from '$lib/trpc';

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

  // tRPC query for shares list
  const sharesQuery = trpc.share.list.query();

  // Delete share function
  const deleteShare = async (id: number) => {
    if (!confirm('Are you sure you want to delete this share?')) return;

    try {
      const success = await api.share.delete.mutate(id.toString());
      if (success) {
        await trpc.share.list.utils.invalidate();
        toast.success('Share deleted');
      } else {
        toast.error('Failed to delete share');
      }
    } catch (error) {
      console.error('Error deleting share:', error);
      toast.error('Failed to delete share');
    }
  };

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
</script>

<PageHeader
  title="Share"
  subtitle="Create and manage public shares of your flight data."
>
  <div class="space-y-4">
    <CreateShare />

    {#if $sharesQuery.isLoading}
      <p class="text-center text-muted-foreground py-8">Loading shares...</p>
    {:else if $sharesQuery.error}
      <p class="text-center text-destructive py-8">
        Error loading shares: {$sharesQuery.error.message}
      </p>
    {:else if !$sharesQuery.data || $sharesQuery.data.length === 0}
      <p class="text-center text-muted-foreground py-8">
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
                    • Expires: {new Date(share.expiresAt).toLocaleDateString()}
                  {:else}
                    • Never expires
                  {/if}
                </p>
                <div class="flex gap-2 text-xs">
                  {#if share.showMap}
                    <span class="bg-primary/10 text-primary px-2 py-1 rounded">
                      Map
                    </span>
                  {/if}
                  {#if share.showStats}
                    <span class="bg-primary/10 text-primary px-2 py-1 rounded">
                      Stats
                    </span>
                  {/if}
                  {#if share.showFlightList}
                    <span class="bg-primary/10 text-primary px-2 py-1 rounded">
                      Flights
                    </span>
                  {/if}
                </div>
              </div>
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => copyShareUrl(share.slug)}
                >
                  <Copy size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => window.open(`/share/${share.slug}`, '_blank')}
                >
                  <ExternalLink size={16} />
                </Button>
                {#key share}
                  <EditShare {share} />
                {/key}
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => deleteShare(share.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</PageHeader>
