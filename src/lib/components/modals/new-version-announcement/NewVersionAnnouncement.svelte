<script lang="ts">
  import { ChevronRight } from '@o7/icon';
  import { toast } from 'svelte-sonner';

  import ReleaseNotes from './ReleaseNotes.svelte';
  import UpdateToast from './UpdateToast.svelte';

  import { Button } from '$lib/components/ui/button';
  import {
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
  } from '$lib/components/ui/modal';
  import { versionState } from '$lib/state.svelte';
  import {
    checkForNewVersions,
    dismissLatestVersion,
  } from '$lib/utils/version';

  let open = $state(false);
  let singleRelease = $derived(
    versionState.newReleases.length === 1
      ? versionState.newReleases[0]
      : undefined,
  );

  const showUpdateToast = () => {
    const count = versionState.newReleases.length;
    const title = singleRelease
      ? `AirTrail ${singleRelease.name} is available`
      : `${count} new AirTrail versions available`;

    const id = toast.custom(UpdateToast, {
      duration: Number.POSITIVE_INFINITY,
      componentProps: {
        title,
        onView: () => {
          open = true;
          dismissLatestVersion();
          toast.dismiss(id);
        },
        onDismiss: () => {
          dismissLatestVersion();
          toast.dismiss(id);
        },
      },
      // Swipe-away counts as dismissal too
      onDismiss: dismissLatestVersion,
    });
  };

  $effect(() => {
    void (async () => {
      await checkForNewVersions();
      if (versionState.newReleases.length > 0) showUpdateToast();
    })();
  });

  const dismissVersion = () => {
    dismissLatestVersion();
    open = false;
  };
</script>

{#if versionState.newReleases.length > 0}
  <Modal
    bind:open
    onOpenChange={(isOpen) => {
      if (!isOpen) dismissVersion();
    }}
  >
    <ModalHeader>
      <div>
        <p class="text-sm text-muted-foreground">
          {versionState.newReleases.length === 1
            ? 'New version available'
            : 'New versions available'}
        </p>
        <h2 class="text-2xl font-semibold tracking-tight">
          {#if singleRelease}
            {singleRelease.name}
          {:else}
            {versionState.newReleases.length} new versions
          {/if}
        </h2>
      </div>
    </ModalHeader>
    <ModalBody>
      {#if singleRelease}
        <div class="typeset typeset-docs max-w-[37em]">
          <ReleaseNotes source={singleRelease.body} />
        </div>
      {:else}
        <div class="space-y-6">
          {#each versionState.newReleases as changelog, i (changelog.name)}
            <details
              open={i === 0}
              class="group border-b border-border pb-4 last:border-b-0 last:pb-0"
            >
              <summary
                class="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold [&::-webkit-details-marker]:hidden"
              >
                <ChevronRight
                  size="16"
                  class="shrink-0 transition-transform group-open:rotate-90"
                />
                Version {changelog.name}
              </summary>
              <div class="typeset typeset-docs mt-2 max-w-[37em]">
                <ReleaseNotes source={changelog.body} />
              </div>
            </details>
          {/each}
        </div>
      {/if}
    </ModalBody>
    <ModalFooter>
      <Button
        variant="outline"
        href="https://airtrail.johan.ohly.dk/docs/install/updating"
        target="_blank"
      >
        How to update
      </Button>
      <Button onclick={dismissVersion}>Got it</Button>
    </ModalFooter>
  </Modal>
{/if}
