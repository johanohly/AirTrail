<script lang="ts">
  import SvelteMarkdown, {
    type RendererComponent,
    type Renderers,
  } from '@humanspeak/svelte-markdown';
  import { markedAlert } from '@humanspeak/svelte-markdown/extensions/alert';

  import MarkdownAlert from './MarkdownAlert.svelte';
  import NewTabLink from './NewTabLink.svelte';

  let { source }: { source: string } = $props();

  interface ReleaseNoteRenderers extends Renderers {
    alert: RendererComponent;
  }

  const extensions = [markedAlert()];
  const renderers: Partial<ReleaseNoteRenderers> = {
    alert: MarkdownAlert,
    link: NewTabLink,
  };

  const compactCompareLinks = (markdown: string) => {
    const wrappedLinksCompacted = markdown.replaceAll(
      /\[(https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/compare\/([^\]\s]+))\]\(\1\)/g,
      (_match, url: string, range: string) => `[\`${range}\`](${url})`,
    );

    return wrappedLinksCompacted.replaceAll(
      /(?<!\]\()https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/compare\/([^\s)]+)/g,
      (url, range: string) => `[\`${range}\`](${url})`,
    );
  };

  // GitHub's auto-generated notes always open with this heading; the modal
  // title already says what the content is
  const stripWhatsChangedHeading = (markdown: string) =>
    markdown.replace(/^\s*#{1,6}\s*What[’']s Changed\s*\r?\n/i, '');

  let normalizedSource = $derived(
    compactCompareLinks(stripWhatsChangedHeading(source)),
  );
</script>

<SvelteMarkdown source={normalizedSource} {extensions} {renderers} />
