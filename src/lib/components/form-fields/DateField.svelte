<script
  lang="ts"
  generics="T extends Record<string, unknown>, Name extends FormPathLeaves<T, string | null | undefined>"
>
  import { type DateValue, parseDate } from '@internationalized/date';
  import { CalendarDays } from '@o7/icon/lucide';
  import { DateField } from 'bits-ui';
  import {
    formFieldProxy,
    type FormPathLeaves,
    type SuperForm,
  } from 'sveltekit-superforms';

  import { Calendar } from '$lib/components/ui/calendar';
  import * as Form from '$lib/components/ui/form';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';

  let {
    form,
    name,
    label,
    required = false,
  }: {
    form: SuperForm<T>;
    name: Name;
    label: string;
    required?: boolean;
  } = $props();

  const { value: fieldValue } = formFieldProxy<
    T,
    Name,
    string | null | undefined
  >(form, name);

  let dateValue: DateValue | undefined = $state(
    $fieldValue ? parseDate($fieldValue) : undefined,
  );

  $effect(() => {
    if ($fieldValue) {
      const date = parseDate($fieldValue);
      if (!dateValue || date.compare(dateValue) !== 0) {
        dateValue = date;
      }
    } else {
      dateValue = undefined;
    }
  });

  const setDateValue = (value: DateValue | undefined) => {
    dateValue = value;
    $fieldValue = value?.toString() ?? '';
    void form.validate(name);
  };
</script>

<Form.Field {form} {name} class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>
        {label}{required ? ' *' : ''}
      </Form.Label>
      <DateField.Root
        bind:value={() => dateValue, (value) => setDateValue(value)}
        granularity="day"
        minValue={parseDate('1970-01-01')}
        locale={navigator.language}
      >
        <div class="flex w-full max-w-[232px] flex-col gap-1.5">
          <DateField.Input
            aria-invalid={props['aria-invalid']}
            class={cn(
              'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-[6px] text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            )}
          >
            {#snippet children({ segments })}
              {#each segments as { part, value }, i (i)}
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
                    onValueChange={setDateValue}
                  />
                </Popover.Content>
              </Popover.Root>
            {/snippet}
          </DateField.Input>
        </div>
      </DateField.Root>
      <input hidden value={$fieldValue ?? ''} name={props.name} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
