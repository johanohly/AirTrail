<script lang="ts">
  import { Copy, ExternalLink, Trash2 } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateShare from './CreateShare.svelte';
  import EditShare from './EditShare.svelte';
  import PageHeader from './PageHeader.svelte';

  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { TextTooltip } from '$lib/components/ui/tooltip/index.js';
  import { api, trpc } from '$lib/trpc';

  // tRPC query for shares list
  const sharesQuery = trpc.share.list.query();

  // Delete share function
  const deleteShare = async (id: number) => {
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
      <p class="text-center text-muted-foreground">No shares created yet.</p>
    {:else}
      <div class="space-y-4">
        {#each $sharesQuery.data as share (share.id)}
          <Card level="2" class="p-4">
            <div class="flex items-center justify-between gap-4">
              <div class="flex-1 space-y-3">
                <div>
                  <h4 class="font-semibold text-lg">{share.slug}</h4>
                  <p class="text-sm text-muted-foreground mt-1">
                    Created {new Date(share.createdAt).toLocaleDateString()}
                    {#if share.expiresAt}
                      • Expires {new Date(share.expiresAt).toLocaleDateString()}
                    {:else}
                      • Never expires
                    {/if}
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  {#if share.showMap}
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                    >
                      Map
                    </span>
                  {/if}
                  {#if share.showStats}
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground"
                    >
                      Statistics
                    </span>
                  {/if}
                  {#if share.showFlightList}
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/50 text-accent-foreground"
                    >
                      Flight List
                    </span>
                  {/if}
                  {#if share.dateFrom || share.dateTo}
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                    >
                      Date Filtered
                    </span>
                  {/if}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <TextTooltip content="Copy share URL">
                  <Button
                    variant="outline"
                    size="icon"
                    onclick={() => copyShareUrl(share.slug)}
                  >
                    <Copy size={16} />
                  </Button>
                </TextTooltip>
                <TextTooltip content="Preview in new tab">
                  <Button
                    variant="outline"
                    size="icon"
                    onclick={() =>
                      window.open(`/share/${share.slug}`, '_blank')}
                  >
                    <ExternalLink size={16} />
                  </Button>
                </TextTooltip>
                {#key share}
                  <EditShare {share} />
                {/key}
                <TextTooltip content="Delete share">
                  <Confirm
                    title="Delete Share"
                    description="Are you sure you want to delete this share? This action cannot be undone."
                    onConfirm={() => deleteShare(share.id)}
                  >
                    {#snippet triggerContent({ props })}
                      <Button variant="outline" size="icon" {...props}>
                        <Trash2 size={16} />
                      </Button>
                    {/snippet}
                  </Confirm>
                </TextTooltip>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </div>
</PageHeader>
