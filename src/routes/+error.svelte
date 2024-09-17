<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
</script>

<div class="flex flex-col h-full items-center justify-center">
  {#if $page.status === 404}
    <h1 class="text-3xl font-bold">404</h1>
    <p class="text-lg">Page not found</p>
    <Button href="/" variant="outline">Go back</Button>
  {:else}
    <h1 class="text-4xl font-bold">An unknown error occured</h1>
    <p class="text-lg">{$page.error?.message}</p>
    <p class="italic text-sm">
      If you are the site owner, please check the logs for more information.
    </p>
  {/if}
</div>
