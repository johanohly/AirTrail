<script lang="ts">
  import { type DateValue, parseDate, Time } from '@internationalized/date';
  import { CalendarDays, CalendarMinus, Settings2 } from '@o7/icon/lucide';
  import { DateField } from 'bits-ui';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/state';
  import { MONTHS } from '$lib/data/datetime';
  import { Button } from '$lib/components/ui/button';
  import { Calendar } from '$lib/components/ui/calendar';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from '$lib/components/ui/popover';
  import * as Select from '$lib/components/ui/select';
  import { TimeInput } from '$lib/components/ui/time-input';
  import * as Tooltip from '$lib/components/ui/tooltip';

  import { PreferenceField } from '$lib/components/preferences';
  import { cn, toTitleCase } from '$lib/utils';
  import { dateValueFromISO } from '$lib/utils/datetime';
  import { formatTimeValue, parseTimeValue } from '$lib/utils/datetime/time';
  import {
    getPreferences,
    pairToDisplay,
    pairToStorage,
    resolveDateLocale,
    resolveFlightEditTimeZone,
    resolveTimeLocale,
  } from '$lib/utils/preferences';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    field,
    form,
    partialDateMode = false,
    onEnablePartialDateMode,
  }: {
    field: 'departure' | 'arrival';
    form: SuperForm<z.infer<typeof flightSchema>>;
    partialDateMode?: boolean;
    onEnablePartialDateMode?: () => void;
  } = $props();
  const { form: formData, validate, errors } = form;
  const yearInputId = `${field}-partial-year`;
  const monthSelectId = `${field}-partial-month`;

  const fallbackTimezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  const prefs = $derived(getPreferences(page.data.user));

  const timeKey = `${field}Time` as 'departureTime' | 'arrivalTime';
  const counterpartField = field === 'departure' ? 'arrival' : 'departure';
  const counterpartTimeKey = `${counterpartField}Time` as
    | 'departureTime'
    | 'arrivalTime';

  const airportTz = $derived(
    (field === 'departure' ? $formData.from?.tz : $formData.to?.tz) ??
      fallbackTimezone,
  );
  const counterpartAirportTz = $derived(
    (counterpartField === 'departure'
      ? $formData.from?.tz
      : $formData.to?.tz) ?? fallbackTimezone,
  );
  const editTz = $derived(resolveFlightEditTimeZone(prefs, airportTz));
  const editLocale = $derived(resolveTimeLocale(prefs));
  const dateLocale = $derived(resolveDateLocale(prefs));

  // editTz-local view of this field's stored pair.
  const display = (): { date: string | null; time: string | null } =>
    pairToDisplay(
      $formData[field] as string | null,
      $formData[timeKey] as string | null,
      airportTz,
      editTz,
    );
  const getDisplayDate = (): string | null => display().date;
  const getDisplayTime = (): string | null => display().time;

  // editTz-local date of the counterpart pair. Used to anchor conversions when
  // the user types a time without a date — the server fills the missing date
  // from the counterpart on submit, and we mirror that here eagerly so the
  // conversion is unambiguous even when it crosses midnight in editTz.
  const counterpartDisplayDate = (): string | null =>
    pairToDisplay(
      $formData[counterpartField] as string | null,
      $formData[counterpartTimeKey] as string | null,
      counterpartAirportTz,
      editTz,
    ).date;

  const setValue = (
    key: 'departure' | 'arrival' | 'departureTime' | 'arrivalTime',
    value: string | null,
  ) => {
    const writingDate = key === field;
    const writingTime = key === timeKey;
    if (!writingDate && !writingTime) {
      formData.update((current) => ({ ...current, [key]: value }));
      return;
    }

    const ownDate = writingDate ? value : getDisplayDate();
    const ownTime = writingTime ? value : getDisplayTime();

    // No time to convert against → pass through.
    if (!ownTime) {
      formData.update((current) => ({ ...current, [key]: value }));
      return;
    }

    // Anchor on this field's date when present; otherwise borrow the
    // counterpart's editTz date so the user can type a time alone. We don't
    // borrow when the user is writing a date (a null date write is an
    // explicit clear, not a request to inherit).
    const anchor = ownDate ?? (writingTime ? counterpartDisplayDate() : null);
    if (!anchor) {
      formData.update((current) => ({ ...current, [key]: value }));
      return;
    }

    const r = pairToStorage(anchor, ownTime, editTz, airportTz);
    formData.update((current) => ({
      ...current,
      [field]: r.date,
      [timeKey]: r.time,
    }));
  };

  const setPartialPrecision = (value: 'month' | 'year') => {
    formData.update((current) => ({
      ...current,
      datePrecision: value,
    }));
  };

  const buildPartialIso = (year: string, month: string) => {
    if (!/^\d{4}$/.test(year)) return null;
    return new Date(
      Date.UTC(Number(year), month ? Number(month) - 1 : 0, 1),
    ).toISOString();
  };

  let dateValue: DateValue | undefined = $state(
    $formData[field] ? dateValueFromISO($formData[field]) : undefined,
  );

  let partialYear = $state('');
  let partialMonth = $state('');
  let lastSyncedPartialDate = $state<string | null>(null);
  let lastSyncedPartialPrecision = $state<'day' | 'month' | 'year' | null>(
    null,
  );

  let timeValue: Time | undefined = $state(
    $formData[`${field}Time`]
      ? parseTimeValue($formData[`${field}Time`] as string)
      : undefined,
  );

  const clearTimeValue = () => {
    if (!timeValue && !$formData[timeKey]) return;
    timeValue = undefined;
    setValue(timeKey, null);
    validate(timeKey);
  };

  $effect(() => {
    const displayDate = getDisplayDate();
    if (displayDate) {
      const date = dateValueFromISO(displayDate);
      if (!dateValue || date.compare(dateValue) !== 0) {
        dateValue = date;
      }
    } else {
      dateValue = undefined;
    }
  });

  $effect(() => {
    const timeString = getDisplayTime();
    if (timeString) {
      const parsed = parseTimeValue(timeString);
      if (!parsed) {
        timeValue = undefined;
        setValue(timeKey, null);
        return;
      }

      if (
        !timeValue ||
        parsed.hour !== timeValue.hour ||
        parsed.minute !== timeValue.minute
      ) {
        timeValue = parsed;
      }
    } else {
      timeValue = undefined;
    }
  });

  $effect(() => {
    const dateString = $formData[field];
    const precision = $formData.datePrecision;

    if (
      dateString === lastSyncedPartialDate &&
      precision === lastSyncedPartialPrecision
    ) {
      return;
    }

    lastSyncedPartialDate = dateString;
    lastSyncedPartialPrecision = precision;

    if (!dateString) {
      partialYear = '';
      partialMonth = '';
      return;
    }

    const date = dateValueFromISO(dateString);
    partialYear = date.year.toString();
    partialMonth =
      precision === 'month' ? date.month.toString().padStart(2, '0') : '';
  });

  const syncPartialDate = () => {
    const iso = buildPartialIso(partialYear, partialMonth);
    setValue(field, iso);
    setPartialPrecision(partialMonth ? 'month' : 'year');
  };
</script>

{#if partialDateMode}
  <Form.Field {form} name={field}>
    <Form.Control>
      {#snippet children({ props })}
        <div
          class="grid gap-2 grid-cols-[minmax(96px,1fr)_minmax(0,1.4fr)] items-start"
        >
          <Label for={yearInputId}>
            Year{field === 'departure' ? ' *' : ''}
          </Label>
          <Label for={monthSelectId}>Month</Label>
        </div>
        <div
          class="grid gap-2 grid-cols-[minmax(96px,1fr)_minmax(0,1.4fr)] items-start"
        >
          <Input
            id={yearInputId}
            bind:value={partialYear}
            placeholder="e.g. 2024"
            inputmode="numeric"
            maxlength={4}
            aria-invalid={$errors[field] ? 'true' : undefined}
            oninput={(event) => {
              partialYear = event.currentTarget.value
                .replace(/\D/g, '')
                .slice(0, 4);
              syncPartialDate();
            }}
            onblur={() => validate(field)}
          />
          <Select.Root
            type="single"
            value={partialMonth || undefined}
            allowDeselect
            onValueChange={(value) => {
              partialMonth = value ?? '';
              syncPartialDate();
              validate(field);
            }}
          >
            <Select.Trigger id={monthSelectId}>
              {partialMonth ? MONTHS[Number(partialMonth) - 1] : 'Select month'}
            </Select.Trigger>
            <Select.Content>
              {#each MONTHS as month, index}
                <Select.Item
                  value={(index + 1).toString().padStart(2, '0')}
                  label={month}
                />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <input hidden bind:value={$formData[field]} name={props.name} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
{:else}
  <div class="grid gap-2 grid-cols-[3fr_2fr] items-start">
    <Form.Field {form} name={field}>
      <Form.Control>
        {#snippet children({ props })}
          <div class="flex h-5 items-center justify-between gap-2">
            <Form.Label class="leading-5">
              {toTitleCase(field)}{field === 'departure' ? ' *' : ''}
            </Form.Label>
            {#if field === 'departure' && onEnablePartialDateMode}
              <Tooltip.Root delayDuration={0} disableHoverableContent>
                <Tooltip.Trigger>
                  {#snippet child({ props: tooltipProps })}
                    <Button
                      {...tooltipProps}
                      variant="ghost"
                      size="icon-sm"
                      class="size-5 p-0 text-muted-foreground hover:bg-accent"
                      onclick={onEnablePartialDateMode}
                    >
                      <CalendarMinus size={14} />
                    </Button>
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content>Use partial date</Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            {/if}
          </div>
          <DateField.Root
            value={dateValue}
            onValueChange={(v) => {
              if (v === undefined) {
                dateValue = undefined;
                setValue(field, null);
                validate(field);
                return;
              }
              dateValue = v;
              setValue(field, dateValue.toDate('UTC').toISOString());
              validate(field);
            }}
            granularity="day"
            minValue={parseDate('1970-01-01')}
            locale={dateLocale}
          >
            <div class="flex w-full flex-col gap-1.5">
              <DateField.Input
                aria-invalid={props['aria-invalid']}
                class={cn(
                  'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-[6px] text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                )}
              >
                {#snippet children({ segments })}
                  {#each segments as { part, value }}
                    <div class="inline-block select-none">
                      {#if part === 'literal'}
                        <DateField.Segment {part} class="text-muted-foreground">
                          {value}
                        </DateField.Segment>
                      {:else}
                        <DateField.Segment
                          {part}
                          class="rounded-md px-1 hover:bg-muted focus:bg-muted focus:text-foreground focus-visible:ring-0! focus-visible:ring-offset-0! aria-[valuetext=Empty]:text-muted-foreground"
                        >
                          {value}
                        </DateField.Segment>
                      {/if}
                    </div>
                  {/each}
                  <Popover.Root>
                    <Popover.Trigger
                      {...props}
                      class="ml-auto inline-flex items-center justify-center text-muted-foreground transition-all hover:text-foreground active:text-foreground"
                    >
                      <CalendarDays size={16} />
                    </Popover.Trigger>
                    <Popover.Content class="p-0">
                      <Calendar
                        type="single"
                        value={dateValue}
                        onValueChange={(v) => {
                          if (v === undefined) {
                            dateValue = undefined;
                            setValue(field, null);
                            validate(field);
                            return;
                          }
                          dateValue = v;
                          setValue(
                            field,
                            dateValue?.toDate('UTC').toISOString() ?? null,
                          );
                          validate(field);
                        }}
                      />
                    </Popover.Content>
                  </Popover.Root>
                {/snippet}
              </DateField.Input>
            </div>
          </DateField.Root>
          <input hidden bind:value={$formData[field]} name={props.name} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name={`${field}Time`}>
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="flex items-center gap-2">
            Time
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    type="button"
                    aria-label="Time display preferences"
                    class="-m-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
                  >
                    <Settings2 size={14} />
                  </button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content align="start" sideOffset={6} class="w-64 p-3">
                <p class="text-xs text-muted-foreground leading-snug pb-3">
                  You're entering times in
                  <span class="font-medium text-foreground">
                    {prefs.flightTimeDisplay === 'airport'
                      ? 'airport-local time'
                      : prefs.flightTimeDisplay === 'utc'
                        ? 'UTC'
                        : `your system timezone (${editTz})`}</span
                  >. These preferences apply to this form and the rest of
                  AirTrail.
                </p>
                <div class="flex flex-col gap-3">
                  <PreferenceField field="flightTimeDisplay" />
                  <PreferenceField field="timeFormat" />
                  <PreferenceField field="dateFormat" />
                </div>
              </Popover.Content>
            </Popover.Root>
          </Form.Label>
          <TimeInput
            value={timeValue}
            onValueChange={(value) => {
              if (!value) {
                clearTimeValue();
                return;
              }

              timeValue = value;
              setValue(timeKey, formatTimeValue(value));
              validate(timeKey);
            }}
            locale={editLocale}
            invalid={!!props['aria-invalid']}
            class={cn(
              'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-[6px] text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            )}
          />
          <input
            hidden
            bind:value={$formData[`${field}Time`]}
            name={props.name}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>
{/if}
