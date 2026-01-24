<script lang="ts">
  import type { TZDate } from '@date-fns/tz';
  import { differenceInCalendarDays, differenceInSeconds } from 'date-fns';
  import { type DateValue, parseDate, Time } from '@internationalized/date';
  import { CalendarDays } from '@o7/icon/lucide';
  import { DateField, TimeField } from 'bits-ui';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { Calendar } from '$lib/components/ui/calendar';
  import * as Form from '$lib/components/ui/form';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';
  import {
    dateValueFromISO,
    formatAsTime,
    isUsingAmPm,
    mergeTimeWithDate,
  } from '$lib/utils/datetime';
  import { formatTimeValue, parseTimeValue } from '$lib/utils/datetime/time';
  import type { flightSchema } from '$lib/zod/flight';

  type FlightFormData = z.infer<typeof flightSchema>;
  type DateFieldKey =
    | 'departure'
    | 'arrival'
    | 'departureScheduled'
    | 'arrivalScheduled'
    | 'takeoffScheduled'
    | 'takeoffActual'
    | 'landingScheduled'
    | 'landingActual';
  type TimeFieldKey =
    | 'departureTime'
    | 'arrivalTime'
    | 'departureScheduledTime'
    | 'arrivalScheduledTime'
    | 'takeoffScheduledTime'
    | 'takeoffActualTime'
    | 'landingScheduledTime'
    | 'landingActualTime';

  let {
    form,
    dateField,
    timeField,
    label,
    timezone,
    baseDateTime = null,
    compareDateTime = null,
    defaultDate = null,
    defaultTime = null,
    placeholder = 'Add time',
    disabled = false,
  }: {
    form: SuperForm<FlightFormData>;
    dateField: DateFieldKey;
    timeField: TimeFieldKey;
    label: string;
    timezone?: string | null;
    baseDateTime?: TZDate | null;
    compareDateTime?: TZDate | null;
    defaultDate?: string | null;
    defaultTime?: string | null;
    placeholder?: string;
    disabled?: boolean;
  } = $props();

  const { form: formData, validate } = form;
  const displayLocale = isUsingAmPm() ? 'en-US' : 'fr-FR';
  const fallbackTimezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  const getFormValues = () => $formData as any;
  const getValue = (field: DateFieldKey | TimeFieldKey) => {
    return (getFormValues()[field] as string | null) ?? null;
  };

  const setValue = (
    field: DateFieldKey | TimeFieldKey,
    value: string | null,
  ) => {
    formData.update((current) => {
      return {
        ...current,
        [field]: value,
      };
    });
  };

  const applyDefaultDate = () => {
    if (dateValue) return;
    if (defaultDate) {
      const fallbackDate = dateValueFromISO(defaultDate);
      dateValue = fallbackDate;
      setValue(dateField, fallbackDate.toDate('UTC').toISOString());
      validateField(dateField);
    }
  };

  const applyDefaultDateTime = () => {
    if (!dateValue) {
      if (defaultDate) {
        const fallbackDate = dateValueFromISO(defaultDate);
        dateValue = fallbackDate;
        setValue(dateField, fallbackDate.toDate('UTC').toISOString());
        validateField(dateField);
      }
    }

    if (!timeValue) {
      if (defaultTime) {
        const parsed = parseTimeValue(defaultTime);
        if (parsed) {
          timeValue = parsed;
          setValue(timeField, formatTimeValue(parsed));
          validateField(timeField);
        }
      }
    }
  };

  const validateField = (field: DateFieldKey | TimeFieldKey) => {
    validate(field as any);
  };

  const getDateTime = (
    date: string | null,
    time: string | null,
    tzId?: string | null,
  ) => {
    if (!date || !time) return null;
    const timezone = tzId ?? fallbackTimezone;
    try {
      return mergeTimeWithDate(date, time, timezone);
    } catch {
      return null;
    }
  };

  const getDateString = (value: DateValue) => {
    return value.toDate('UTC').toISOString().slice(0, 10);
  };

  const shouldUseNativePicker = () => {
    if (typeof window === 'undefined') return false;
    if (!window.matchMedia?.('(pointer: coarse)').matches) return false;
    return !!nativeInput?.showPicker;
  };

  let open = $state(false);
  let nativeInput = $state<HTMLInputElement | null>(null);

  let dateValue: DateValue | undefined = $state(
    getValue(dateField) ? dateValueFromISO(getValue(dateField)!) : undefined,
  );
  let timeValue: Time | undefined = $state(
    getValue(timeField) ? parseTimeValue(getValue(timeField)!) : undefined,
  );

  $effect(() => {
    const dateString = getValue(dateField);
    if (dateString) {
      const date = dateValueFromISO(dateString);
      if (!dateValue || date.compare(dateValue) !== 0) {
        dateValue = date;
      }
    } else {
      dateValue = undefined;
    }
  });

  $effect(() => {
    const timeString = getValue(timeField);
    if (timeString) {
      const parsed = parseTimeValue(timeString);
      if (!parsed) {
        timeValue = undefined;
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

  const currentDateTime = $derived.by(() =>
    getDateTime(getValue(dateField), getValue(timeField), timezone),
  );

  const displayTime = $derived.by(() => {
    if (currentDateTime) {
      return formatAsTime(currentDateTime, displayLocale);
    }
    if (timeValue) {
      return formatTimeValue(timeValue);
    }
    return null;
  });

  const dayOffset = $derived.by(() => {
    if (!currentDateTime || !baseDateTime) return 0;
    return differenceInCalendarDays(currentDateTime, baseDateTime);
  });

  const offsetLabel = $derived.by(() => {
    if (!dayOffset) return null;
    return `${dayOffset > 0 ? '+' : ''}${dayOffset}`;
  });

  const timingStatus = $derived.by(() => {
    if (!compareDateTime || !currentDateTime) return null;
    const diff = differenceInSeconds(currentDateTime, compareDateTime);
    if (diff === 0) return 'on-time';
    return diff < 0 ? 'early' : 'late';
  });

  const timingClass = $derived.by(() => {
    if (timingStatus === 'early')
      return 'text-emerald-600 dark:text-emerald-500';
    if (timingStatus === 'late') return 'text-rose-600 dark:text-rose-500';
    return '';
  });

  const nativeValue = $derived.by(() => {
    if (!dateValue || !timeValue) return '';
    return `${getDateString(dateValue)}T${formatTimeValue(timeValue)}`;
  });

  const handleNativeChange = (value: string) => {
    if (!value) {
      dateValue = undefined;
      timeValue = undefined;
      setValue(dateField, null);
      setValue(timeField, null);
      validateField(dateField);
      validateField(timeField);
      return;
    }

    const [datePart, timePart] = value.split('T');
    if (datePart) {
      const parsedDate = parseDate(datePart);
      dateValue = parsedDate;
      setValue(dateField, parsedDate.toDate('UTC').toISOString());
      validateField(dateField);
    }

    if (timePart) {
      const timeString = timePart.slice(0, 5);
      timeValue = parseTimeValue(timeString);
      setValue(timeField, timeString);
      validateField(timeField);
    }
  };

  const handleTriggerClick = (
    event: MouseEvent,
    openPopover?: (event: MouseEvent) => void,
  ) => {
    if (!displayTime) {
      applyDefaultDateTime();
    }
    if (!shouldUseNativePicker()) {
      openPopover?.(event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    open = false;
    nativeInput?.showPicker?.();
  };
</script>

<div class="">
  <Form.Field {form} name={dateField as any}>
    <Form.Control>
      {#snippet children({ props })}
        <div>
          <Popover.Root bind:open>
            <Popover.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  class={cn(
                    'group flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-sm font-medium shadow-xs transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] hover:bg-border dark:bg-input/30 dark:hover:bg-input/50',
                    'hover:border-border focus-visible:outline-hidden',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                  {disabled}
                  onclick={(event) =>
                    handleTriggerClick(
                      event,
                      (props as { onclick?: (event: MouseEvent) => void })
                        .onclick,
                    )}
                >
                  <span
                    class={cn(
                      'flex items-baseline gap-1.5 truncate',
                      !displayTime &&
                        'text-muted-foreground text-xs font-medium',
                      timingClass,
                    )}
                  >
                    <span>{displayTime ?? placeholder}</span>
                    {#if offsetLabel}
                      <span
                        class="text-[10px] font-semibold text-muted-foreground"
                      >
                        {offsetLabel}
                      </span>
                    {/if}
                  </span>
                  <CalendarDays
                    size={14}
                    class="text-muted-foreground transition group-hover:text-foreground"
                  />
                </button>
              {/snippet}
            </Popover.Trigger>
            <Popover.Content class="w-72 p-3" align="start">
              <div class="grid gap-3">
                <div class="grid gap-1.5">
                  <span class="text-xs font-semibold text-muted-foreground">
                    {label} date
                  </span>
                  <DateField.Root
                    bind:value={
                      () => dateValue,
                      (v) => {
                        if (v === undefined) {
                          dateValue = undefined;
                          setValue(dateField, null);
                          validateField(dateField);
                          return;
                        }
                        dateValue = v;
                        setValue(
                          dateField,
                          dateValue.toDate('UTC').toISOString(),
                        );
                        validateField(dateField);
                      }
                    }
                    granularity="day"
                    minValue={parseDate('1970-01-01')}
                    locale={navigator.language}
                  >
                    <div class="flex w-full flex-col gap-1.5">
                      <DateField.Input
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
                                <DateField.Segment
                                  {part}
                                  class="text-muted-foreground"
                                >
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
                                    setValue(dateField, null);
                                    validateField(dateField);
                                    return;
                                  }
                                  dateValue = v;
                                  setValue(
                                    dateField,
                                    dateValue?.toDate('UTC').toISOString() ??
                                      null,
                                  );
                                  validateField(dateField);
                                }}
                              />
                            </Popover.Content>
                          </Popover.Root>
                        {/snippet}
                      </DateField.Input>
                    </div>
                  </DateField.Root>
                </div>
                <div class="grid gap-1.5">
                  <span class="text-xs font-semibold text-muted-foreground">
                    {label} time
                  </span>
                  <TimeField.Root
                    bind:value={
                      () => timeValue,
                      (value) => {
                        if (!value) {
                          timeValue = undefined;
                          setValue(timeField, null);
                          validateField(timeField);
                          return;
                        }

                        applyDefaultDate();
                        timeValue = value;
                        setValue(timeField, formatTimeValue(value));
                        validateField(timeField);
                      }
                    }
                    granularity="minute"
                    locale={navigator.language}
                  >
                    <div class="flex w-full flex-col gap-1.5">
                      <TimeField.Input
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
                                <TimeField.Segment
                                  {part}
                                  class="text-muted-foreground"
                                >
                                  {value}
                                </TimeField.Segment>
                              {:else}
                                <TimeField.Segment
                                  {part}
                                  class="rounded-md px-1 hover:bg-muted focus:bg-muted focus:text-foreground focus-visible:ring-0! focus-visible:ring-offset-0! aria-[valuetext=Empty]:text-muted-foreground"
                                >
                                  {value}
                                </TimeField.Segment>
                              {/if}
                            </div>
                          {/each}
                        {/snippet}
                      </TimeField.Input>
                    </div>
                  </TimeField.Root>
                </div>
              </div>
            </Popover.Content>
          </Popover.Root>
          <input
            hidden
            bind:value={$formData[dateField as keyof FlightFormData]}
            name={props.name}
          />
          <input
            bind:this={nativeInput}
            type="datetime-local"
            class="sr-only"
            value={nativeValue}
            {disabled}
            onchange={(event) =>
              handleNativeChange(
                (event.currentTarget as HTMLInputElement).value,
              )}
          />
        </div>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors class="text-xs" />
  </Form.Field>
  <Form.Field {form} name={timeField as any}>
    <Form.Control>
      {#snippet children({ props })}
        <input
          hidden
          bind:value={$formData[timeField as keyof FlightFormData]}
          name={props.name}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors class="text-xs" />
  </Form.Field>
</div>
