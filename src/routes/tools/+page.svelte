<script lang="ts">
  import { CopyMinus, Database } from '@o7/icon/lucide';

  import { page } from '$app/state';
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
</div>
