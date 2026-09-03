<script lang="ts">
  import { Check, ShieldCheck } from '@o7/icon/lucide';
  import type { PageProps } from './$types';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  const { data }: PageProps = $props();
</script>

<svelte:head><title>Authorize {data.clientName} · AirTrail</title></svelte:head>

<main class="flex min-h-full items-center justify-center p-4 sm:p-8">
  <Card class="w-full max-w-lg p-6 sm:p-8">
    <div class="mb-6 flex items-start gap-4">
      <div
        class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
      >
        <ShieldCheck size={22} />
      </div>
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-balance">
          Allow {data.clientName} to access AirTrail?
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Connecting to {data.resource}
        </p>
      </div>
    </div>

    <p class="mb-3 text-sm font-medium">
      This app is requesting permission to:
    </p>
    <ul class="mb-6 space-y-3" aria-label="Requested permissions">
      {#each data.scopes as scope}
        <li class="flex gap-3">
          <Check class="text-primary mt-0.5 shrink-0" size={16} />
          <div class="min-w-0">
            <p class="text-sm font-medium">{scope.description}</p>
            <p
              class="truncate text-xs text-muted-foreground"
              title={scope.name}
            >
              {scope.name}
            </p>
          </div>
        </li>
      {/each}
    </ul>

    <p class="mb-6 text-xs leading-relaxed text-muted-foreground">
      You can revoke this access at any time in Settings → Security → Connected
      apps.
    </p>
    <form
      method="POST"
      class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
    >
      <input type="hidden" name="id" value={data.id} />
      <Button type="submit" name="decision" value="deny" variant="outline"
        >Deny</Button
      >
      <Button type="submit" name="decision" value="approve">Allow access</Button
      >
    </form>
  </Card>
</main>
