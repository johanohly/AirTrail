<script lang="ts">
  import {
    CopyMinus,
    Database,
    RefreshCw,
    LoaderCircle,
  } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { page } from '$app/state';
  import Button from '$lib/components/ui/button/button.svelte';

  let syncingAirlines = $state(false);
  let syncingAircraft = $state(false);
  let syncingIcons = $state(false);
  let overwriteExisting = $state(false);
  let includeDefunct = $state(false);

  async function syncAirlines() {
    syncingAirlines = true;
    try {
      const response = await fetch('/api/sync/airlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: overwriteExisting, includeDefunct }),
      });
      const data = await response.json();
      if (data.success) {
        const { added, updated, errors } = data.result;
        let message = `Added ${added} airlines, Updated ${updated}`;
        if (errors.length > 0) {
          message += ` (${errors.length} errors)`;
        }
        toast.success(message);
      } else {
        toast.error(data.error || 'Failed to sync airlines');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to sync airlines',
      );
    } finally {
      syncingAirlines = false;
    }
  }

  async function syncAircraft() {
    syncingAircraft = true;
    try {
      const response = await fetch('/api/sync/aircraft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: overwriteExisting }),
      });
      const data = await response.json();
      if (data.success) {
        const { added, updated, errors } = data.result;
        let message = `Added ${added} aircraft, Updated ${updated}`;
        if (errors.length > 0) {
          message += ` (${errors.length} errors)`;
        }
        toast.success(message);
      } else {
        toast.error(data.error || 'Failed to sync aircraft');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to sync aircraft',
      );
    } finally {
      syncingAircraft = false;
    }
  }

  async function syncIcons() {
    syncingIcons = true;
    try {
      const response = await fetch('/api/sync/icons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: overwriteExisting }),
      });
      const data = await response.json();
      if (data.success) {
        const { synced, errors } = data.result;
        let message = `Synced ${synced} icons`;
        if (errors.length > 0) {
          message += ` (${errors.length} errors)`;
        }
        toast.success(message);
      } else {
        toast.error(data.error || 'Failed to sync icons');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync icons');
    } finally {
      syncingIcons = false;
    }
  }
</script>

<div class="container h-full flex flex-col items-center justify-center gap-2">
  <h1 class="text-2xl font-medium">Tools</h1>
  <div class="flex flex-col md:flex-row gap-2">
    {#if page.data.user?.role === 'owner'}
      <a
        href="/tools/sql"
        class="flex items-center space-x-4 rounded-md border p-4 transition-colors hover:bg-card-hover"
      >
        <Database />
        <div class="space-y-1">
          <p class="text-sm font-medium leading-none">SQL Console</p>
          <p class="text-muted-foreground text-sm">
            Write and execute SQL queries.
          </p>
        </div>
      </a>
    {/if}
    <a
      href="/tools/deduplicate"
      class="flex items-center space-x-4 rounded-md border p-4 transition-colors hover:bg-card-hover"
    >
      <CopyMinus />
      <div class="space-y-1">
        <p class="text-sm font-medium leading-none">Remove Duplicates</p>
        <p class="text-muted-foreground text-sm">
          Find and remove duplicate flights.
        </p>
      </div>
    </a>
  </div>

  {#if page.data.user?.role === 'owner'}
    <div class="mt-4 w-full max-w-2xl">
      <div class="rounded-md border p-4">
        <div class="flex items-center space-x-4 mb-4">
          <RefreshCw />
          <div class="space-y-1">
            <p class="text-sm font-medium leading-none">Data Sync</p>
            <p class="text-muted-foreground text-sm">
              Sync airline and aircraft data from GitHub.
            </p>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center space-x-2">
            <input
              type="checkbox"
              id="overwrite"
              bind:checked={overwriteExisting}
              class="rounded border-gray-300"
            />
            <label for="overwrite" class="text-sm"
              >Overwrite existing entries</label
            >
          </div>

          <div class="flex items-center space-x-2">
            <input
              type="checkbox"
              id="defunct"
              bind:checked={includeDefunct}
              class="rounded border-gray-300"
            />
            <label for="defunct" class="text-sm">Include defunct airlines</label
            >
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              onclick={syncAirlines}
              disabled={syncingAirlines}
              variant="outline"
            >
              {#if syncingAirlines}
                <LoaderCircle size={16} class="mr-2 animate-spin" />
              {/if}
              Sync Airlines
            </Button>

            <Button
              onclick={syncAircraft}
              disabled={syncingAircraft}
              variant="outline"
            >
              {#if syncingAircraft}
                <LoaderCircle size={16} class="mr-2 animate-spin" />
              {/if}
              Sync Aircraft
            </Button>

            <Button
              onclick={syncIcons}
              disabled={syncingIcons}
              variant="outline"
            >
              {#if syncingIcons}
                <LoaderCircle size={16} class="mr-2 animate-spin" />
              {/if}
              Sync Airline Icons
            </Button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
