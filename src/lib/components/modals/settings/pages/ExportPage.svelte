<script lang="ts">
  import { FileSpreadsheet, FileBraces, RefreshCw } from '@o7/icon/lucide';
  import { formatDistanceToNow } from 'date-fns';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '.';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import { confirmation } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { CopyInput } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Switch } from '$lib/components/ui/switch';
  import { api, trpc } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import { getErrorText } from '$lib/utils/error';
  import {
    REMINDER_OFFSETS,
    type CalendarUpdateInput,
    type ReminderOffset,
  } from '$lib/zod/calendar';

  const canExport = $derived(
    hasClientPermission(page.data.authorization, 'flight.export.own'),
  );

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    toast.info('Your download should start shortly');
    URL.revokeObjectURL(url);
  };

  const downloadCsv = async () => {
    const csv = await api.flight.exportCsv.query();
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'airtrail.csv');
  };

  const downloadJson = async () => {
    const json = await api.flight.exportJson.query();
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'airtrail.json');
  };

  const REMINDER_LABELS: Record<string, string> = {
    none: 'None',
    30: '30 minutes',
    60: '1 hour',
    120: '2 hours',
    180: '3 hours',
    1440: '1 day',
  };

  const REMINDER_OPTIONS = [
    { value: 'none', label: REMINDER_LABELS.none },
    ...REMINDER_OFFSETS.map((minutes) => ({
      value: minutes.toString(),
      label: REMINDER_LABELS[minutes.toString()],
    })),
  ];

  const feedQuery = trpc.calendar.get.query();

  const feed = $derived($feedQuery.data?.enabled ? $feedQuery.data : null);

  let reminder = $state('120');
  let showEmoji = $state(true);
  let busy = $state(false);

  // Keep the controls in step with the server state after refetches.
  $effect(() => {
    if (feed) {
      reminder = feed.reminderOffsetMinutes?.toString() ?? 'none';
      showEmoji = feed.showEmoji;
    }
  });

  const feedUrl = $derived(
    feed ? `${window.location.origin}/api/calendar/${feed.token}.ics` : '',
  );
  const subscribeUrl = $derived(
    feed
      ? `webcal://${window.location.host}/api/calendar/${feed.token}.ics`
      : '',
  );

  const handleError = (error: unknown, fallback: string) => {
    console.error('Calendar feed error:', error);
    toast.error(getErrorText(error) || fallback);
  };

  const setEnabled = async (enable: boolean) => {
    if (!enable) {
      const confirmed = await confirmation.show({
        title: 'Disable calendar feed?',
        description:
          'The feed URL stops working immediately. Calendar apps subscribed to it will no longer update.',
        confirmText: 'Disable',
      });
      if (!confirmed) return;
    }

    busy = true;
    try {
      if (enable) {
        await api.calendar.enable.mutate();
        toast.success('Calendar feed enabled');
      } else {
        await api.calendar.disable.mutate();
        toast.success('Calendar feed disabled');
      }
      await trpc.calendar.get.utils.invalidate();
    } catch (error) {
      handleError(
        error,
        enable
          ? 'Failed to enable calendar feed'
          : 'Failed to disable calendar feed',
      );
    } finally {
      busy = false;
    }
  };

  const saveSettings = async (patch: CalendarUpdateInput) => {
    busy = true;
    try {
      await api.calendar.update.mutate(patch);
      await trpc.calendar.get.utils.invalidate();
      toast.success('Calendar feed updated');
    } catch (error) {
      handleError(error, 'Failed to update calendar feed');
      if (feed) {
        reminder = feed.reminderOffsetMinutes?.toString() ?? 'none';
        showEmoji = feed.showEmoji;
      }
    } finally {
      busy = false;
    }
  };

  const setReminder = (value: string) => {
    if (value === reminder) return;
    reminder = value;
    const reminderOffsetMinutes =
      value === 'none' ? null : (Number(value) as ReminderOffset);
    void saveSettings({ reminderOffsetMinutes, showEmoji });
  };

  const setShowEmoji = (value: boolean) => {
    if (value === showEmoji) return;
    showEmoji = value;
    const reminderOffsetMinutes =
      reminder === 'none' ? null : (Number(reminder) as ReminderOffset);
    void saveSettings({ reminderOffsetMinutes, showEmoji: value });
  };

  const regenerate = async () => {
    const confirmed = await confirmation.show({
      title: 'Regenerate feed URL?',
      description:
        'Existing subscriptions stop updating until re-subscribed with the new URL.',
      confirmText: 'Regenerate',
    });
    if (!confirmed) return;

    busy = true;
    try {
      await api.calendar.regenerate.mutate();
      await trpc.calendar.get.utils.invalidate();
      toast.success('Feed URL regenerated');
    } catch (error) {
      handleError(error, 'Failed to regenerate the feed URL');
    } finally {
      busy = false;
    }
  };
</script>

<PageHeader title="Export">
  {#snippet subtitleHtml()}
    <p class="text-muted-foreground text-sm">
      Export your data. Learn more about the data formats <a
        href="https://airtrail.johan.ohly.dk/docs/features/export#export-formats"
        target="_blank"
        class="text-blue-500 underline">in the documentation</a
      >.
    </p>
  {/snippet}
  <div class="space-y-6">
    <div class="flex">
      <button onclick={downloadCsv} class="w-full">
        <Card
          class={cn(
            'cursor-pointer py-12 border-2 border-dashed border-r-0 rounded-r-none flex flex-col items-center hover:bg-card-hover dark:hover:bg-dark-2',
          )}
        >
          <FileSpreadsheet size={64} />
          <span class="text-muted-foreground">.csv</span>
        </Card>
      </button>
      <button onclick={downloadJson} class="w-full">
        <Card
          class={cn(
            'cursor-pointer py-12 border-2 border-dashed rounded-l-none flex flex-col items-center hover:bg-card-hover dark:hover:bg-dark-2',
          )}
        >
          <FileBraces size={64} />
          <span class="text-muted-foreground">.json</span>
        </Card>
      </button>
    </div>

    <section class="space-y-4">
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <h4 class="font-medium">Calendar feed</h4>
          <p class="text-muted-foreground text-sm">
            Subscribe to your flights from Google Calendar, Apple Calendar, or
            any other calendar app.
          </p>
        </div>
        <Switch
          checked={$feedQuery.data?.enabled ?? false}
          disabled={!canExport || busy || $feedQuery.isLoading}
          onCheckedChange={(value) => setEnabled(value)}
        />
      </div>

      {#if !canExport}
        <p class="rounded-md border p-3 text-sm text-muted-foreground">
          Your role cannot export flight data, so the calendar feed is
          unavailable and existing URLs are inactive.
        </p>
      {:else if $feedQuery.isLoading}
        <p class="py-2 text-center text-muted-foreground">
          Loading calendar feed...
        </p>
      {:else if feed}
        <Card level="2" class="space-y-4 p-4">
          <div class="space-y-1.5">
            <p class="text-sm font-medium">Feed URL</p>
            <div class="flex gap-2">
              <CopyInput value={feedUrl} readonly class="flex-1" />
              <Button variant="outline" href={subscribeUrl}>Subscribe</Button>
            </div>
            <p class="text-muted-foreground text-xs">
              Anyone with this URL can read your flight dates. Treat it like a
              password.
            </p>
          </div>

          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium">Reminder</p>
              <p class="text-muted-foreground text-sm">
                How long before departure to remind you.
              </p>
            </div>
            <Select.Root
              type="single"
              value={reminder}
              onValueChange={(value) => value && setReminder(value)}
            >
              <Select.Trigger class="w-40">
                {REMINDER_LABELS[reminder] ?? reminder}
              </Select.Trigger>
              <Select.Content>
                {#each REMINDER_OPTIONS as option (option.value)}
                  <Select.Item value={option.value} label={option.label} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium">Show emoji in titles</p>
              <p class="text-muted-foreground text-sm">
                Prefix event titles with an airplane emoji.
              </p>
            </div>
            <Switch
              checked={showEmoji}
              disabled={busy}
              onCheckedChange={(value) => setShowEmoji(value)}
            />
          </div>

          <div class="flex items-center justify-between gap-4 border-t pt-4">
            <p class="text-muted-foreground text-sm">
              {#if feed.lastFetched}
                Last fetched
                {formatDistanceToNow(new Date(feed.lastFetched), {
                  addSuffix: true,
                })}
              {:else}
                Never fetched
              {/if}
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onclick={() => regenerate()}
            >
              <RefreshCw size={14} />
              Regenerate token
            </Button>
          </div>
        </Card>
      {:else if !$feedQuery.error}
        <p class="text-muted-foreground text-sm">
          Turn on the feed to get a URL your calendar app can subscribe to.
        </p>
      {/if}
    </section>
  </div>
</PageHeader>
