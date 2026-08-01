<script lang="ts">
  import SvelteMarkdown from '@humanspeak/svelte-markdown';
  import type { AlertType } from '@humanspeak/svelte-markdown/extensions/alert';
  import {
    CircleAlert,
    Info,
    Lightbulb,
    ShieldAlert,
    TriangleAlert,
  } from '@o7/icon';

  import NewTabLink from './NewTabLink.svelte';

  import * as Alert from '$lib/components/ui/alert';
  import type { AlertVariant } from '$lib/components/ui/alert';

  let { text, alertType }: { text: string; alertType: AlertType } = $props();

  const callouts = {
    note: { title: 'Note', icon: Info, variant: 'info' },
    tip: { title: 'Tip', icon: Lightbulb, variant: 'success' },
    important: { title: 'Important', icon: ShieldAlert, variant: 'important' },
    warning: { title: 'Warning', icon: TriangleAlert, variant: 'warning' },
    caution: { title: 'Caution', icon: CircleAlert, variant: 'destructive' },
  } satisfies Record<
    AlertType,
    { title: string; icon: typeof Info; variant: AlertVariant }
  >;

  const markdownRenderers = { link: NewTabLink };
  let callout = $derived(callouts[alertType]);
  let Icon = $derived(callout.icon);
</script>

<Alert.Root
  variant={callout.variant}
  role="note"
  class="callout-{alertType} my-5 first:mt-0 last:mb-0"
>
  <Icon aria-hidden="true" />
  <Alert.Title>{callout.title}</Alert.Title>
  <Alert.Description
    class="[&_p]:text-muted-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0"
  >
    <SvelteMarkdown source={text} renderers={markdownRenderers} />
  </Alert.Description>
</Alert.Root>
