<script lang="ts">
  import { HeartCrack } from '@o7/icon/lucide';
  import { onMount } from 'svelte';

  import { Button } from '$lib/components/ui/button';
  import type { FlightData } from '$lib/utils';

  let {
    flights,
    filteredFlights,
  }: {
    flights: FlightData[];
    filteredFlights: FlightData[];
  } = $props();

  let details = $state('');
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(details);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 2000);
    } catch {
      // ignore
    }
  }

  onMount(() => {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null);

    const lines: string[] = [];
    lines.push(`Time: ${new Date().toISOString()}`);
    lines.push(`URL: ${location.href}`);
    lines.push(`UserAgent: ${navigator.userAgent}`);

    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      lines.push(
        `GPU Vendor: ${dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(0x1f00)}`,
      );
      lines.push(
        `GPU Renderer: ${dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(0x1f01)}`,
      );
      lines.push(`WebGL Version: ${gl.getParameter(0x1f02)}`);
    } else {
      lines.push('WebGL: unavailable');
    }

    details = lines.join('\n');
  });
</script>

<div
  class="flex h-full items-center justify-center bg-muted/20"
  data-testid="map-fallback"
>
  <div class="incompatibility" role="alert" aria-live="polite">
    <div class="box">
      <div class="hdr">
        <svg
          class="size-12 fill-destructive"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          ><!--!Font Awesome Pro v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2026 Fonticons, Inc.--><path
            d="M352 384L224 272L304 192L240.7 103.3C226.8 98.5 212.1 96 197.1 96C123.6 96 64 155.6 64 229.1C64 365.9 217.5 489.3 320 560C422.5 489.3 576 365.9 576 229.1C576 155.6 516.4 96 442.9 96C414.1 96 386.6 105.3 364 121.9L384 192L288 272L352 384z"
          /></svg
        >
        <h2>We couldn't show the map</h2>
      </div>
      <p>
        We couldn't render the interactive flight map right now. Your browser or
        device may be missing a required graphics feature (WebGL). You can still
        browse your {flights.length} flight{flights.length === 1 ? '' : 's'}
        using the flight list and all other features.
      </p>

      <ul class="tips">
        <li>
          <a
            href="https://get.webgl.org/"
            target="_blank"
            rel="noreferrer noopener"
            class="text-primary hover:underline"
          >
            Check if WebGL is working in your browser.
          </a>
        </li>
        <li>
          Make sure hardware acceleration is enabled in your browser settings.
        </li>
        <li>Update your graphics drivers and restart your browser.</li>
        <li>Try another browser (Chrome, Edge, Firefox, or Safari).</li>
      </ul>

      <div class="actions">
        <Button
          href="https://get.webgl.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Test WebGL
        </Button>
      </div>

      <details class="details">
        <summary>Technical details</summary>
        <div class="details-pre">
          <button
            class="copy-button"
            type="button"
            onclick={copyDetails}
            aria-live="polite"
            title="Copy technical details"
          >
            {#if copied}Copied!{:else}Copy{/if}
          </button>
          <pre>{details}</pre>
        </div>
      </details>
    </div>
  </div>
</div>

<style>
  .incompatibility {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 1.5rem;
  }

  .box {
    width: min(48rem, 100%);
    background: var(--background);
    color: var(--foreground);
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 6px 24px
      color-mix(in oklab, var(--foreground) 8%, transparent);
    border: 1px solid var(--border);
    text-align: center;
  }

  .hdr {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    align-items: center;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  p {
    margin: 0.25rem 0 0.5rem;
    padding-inline: 2rem;
    line-height: 1.5;
    color: var(--muted-foreground);
  }

  .tips {
    display: inline-block;
    text-align: left;
    margin: 0.25rem auto;
    padding-left: 1.25rem;
    list-style: disc outside;
    color: var(--muted-foreground);
  }

  .tips li {
    margin: 0.25rem 0;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0.75rem 0 0;
    justify-content: center;
  }

  .details {
    margin-top: 0.75rem;
  }

  .details summary {
    cursor: pointer;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }

  .details-pre {
    position: relative;
    margin: 0.5rem auto 0;
    padding: 0.5rem 2.25rem 0.5rem 0.75rem;
    background: color-mix(in oklab, var(--foreground) 6%, transparent);
    border-radius: 0.5rem;
    overflow: auto;
    max-height: min(20rem, 50vh);
  }

  .details-pre pre {
    color: var(--muted-foreground);
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    text-align: left;
  }

  .copy-button {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.8rem;
    line-height: 1;
    border: 1px solid color-mix(in oklab, var(--foreground) 18%, transparent);
    background: color-mix(in oklab, var(--foreground) 2%, transparent);
    color: inherit;
    border-radius: 0.35rem;
    cursor: pointer;
  }

  .copy-button:hover,
  .copy-button:focus {
    outline: none;
    background: color-mix(in oklab, var(--foreground) 8%, transparent);
  }
</style>
