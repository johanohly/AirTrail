<script lang="ts">
  import { ShieldCheck } from '@o7/icon/lucide';

  import type { PageProps } from './$types';

  import ScopePicker from '$lib/components/access/ScopePicker.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { MCP_DOCUMENTATION_URL } from '$lib/api/v1/discovery';
  import type { ApiScope } from '$lib/api/v1/scopes';

  const { data }: PageProps = $props();
  // Pre-select only what the client asked for, not everything the role allows.
  let selectedScopeNames = $state<ApiScope[]>(
    data.scopes.filter((scope) => scope.requested).map((scope) => scope.name),
  );
</script>

<svelte:head><title>Authorize {data.clientName} · AirTrail</title></svelte:head>

<div class="flex min-h-screen flex-col bg-muted/20 dark:bg-background">
  <header class="border-b bg-background">
    <div
      class="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-4 sm:px-8"
    >
      <a href="/" class="flex items-center gap-2 text-foreground no-underline">
        <img src="/favicon.svg" alt="AirTrail" class="size-8" />
        <span class="text-sm font-semibold tracking-tight">AirTrail</span>
      </a>
      <span class="h-6 w-px bg-border" aria-hidden="true"></span>
      <span class="text-sm text-muted-foreground"
        >{data.authorizationTarget}</span
      >
    </div>
  </header>

  <main
    class="flex flex-1 items-start justify-center px-4 py-8 sm:px-8 sm:py-10"
  >
    <Card class="w-full max-w-2xl overflow-hidden p-0">
      <div class="border-b px-6 py-6 text-center sm:px-8">
        <h1 class="text-lg font-semibold tracking-tight text-foreground">
          Authorize application
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Grant access to your AirTrail account
        </p>
      </div>

      <div class="p-6 sm:p-8">
        <section class="mb-6" aria-labelledby="client-heading">
          <h2 id="client-heading" class="sr-only">Client identity</h2>
          <div
            class="mb-3 inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium"
          >
            <span
              class="flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <ShieldCheck size={13} />
            </span>
            <span class="max-w-[min(70vw,28rem)] truncate"
              >{data.clientName}</span
            >
          </div>

          <div class="overflow-hidden rounded-md border bg-muted/20">
            <div
              class="flex items-baseline justify-between gap-4 px-3 py-2.5 text-sm"
            >
              <span class="text-muted-foreground">Redirect URI hostname</span>
              <code
                class="break-all text-right text-xs font-semibold text-foreground"
                >{data.redirectHost}</code
              >
            </div>
            <div
              class="flex items-baseline justify-between gap-4 border-t px-3 py-2.5 text-sm"
            >
              <span class="text-muted-foreground">Resource</span>
              <code
                class="break-all text-right text-xs font-semibold text-foreground"
                >{data.resource}</code
              >
            </div>
          </div>
        </section>

        <section class="mb-6" aria-label="Permissions">
          <ScopePicker
            scopes={data.scopes}
            bind:selected={selectedScopeNames}
            permissionsHelp="These permissions let the application access your AirTrail data. They are limited by your current role and can be revoked in Settings → Security → Connected apps."
          />
        </section>

        <form
          method="POST"
          class="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"
        >
          <input type="hidden" name="id" value={data.id} />
          {#each selectedScopeNames as scope}
            <input type="hidden" name="scope" value={scope} />
          {/each}
          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="outline"
            class="sm:order-1">Deny</Button
          >
          <Button
            type="submit"
            name="decision"
            value="approve"
            class="sm:order-2 sm:min-w-40">Allow access</Button
          >
        </form>
      </div>
    </Card>
  </main>

  <footer
    class="border-t bg-background px-4 py-4 text-center text-xs text-muted-foreground sm:px-8"
  >
    <a href="/" class="transition-colors hover:text-foreground">AirTrail</a>
    <span class="mx-2" aria-hidden="true">·</span>
    <a
      href={MCP_DOCUMENTATION_URL}
      class="transition-colors hover:text-foreground">MCP docs</a
    >
  </footer>
</div>
