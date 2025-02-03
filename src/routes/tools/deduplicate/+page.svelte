<script lang="ts">
  import {
    getCoreRowModel,
    type RowSelectionState,
  } from '@tanstack/table-core';
  import { createRawSnippet } from 'svelte';
  import { toast } from 'svelte-sonner';

  import type { PageProps } from './$types';

  import { invalidateAll } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import {
    createSvelteTable,
    FlexRender,
    renderComponent,
    renderSnippet,
  } from '$lib/components/ui/data-table';
  import * as Table from '$lib/components/ui/table';
  import { api } from '$lib/trpc';
  import { prepareFlightData } from '$lib/utils';
  import { formatAsDate, formatAsDateTime } from '$lib/utils/datetime';

  let { data }: PageProps = $props();
  const flights = $derived.by(() => prepareFlightData(data.flights));

  let rowSelection = $state<RowSelectionState>({});
  const table = createSvelteTable({
    get data() {
      return flights;
    },
    columns: [
      {
        id: 'select',
        header: ({ table }) =>
          renderComponent(Checkbox, {
            checked: table.getIsAllPageRowsSelected(),
            indeterminate:
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected(),
            onCheckedChange: (value) =>
              table.toggleAllPageRowsSelected(!!value),
            'aria-label': 'Select all',
          }),
        cell: ({ row }) =>
          renderComponent(Checkbox, {
            checked: row.getIsSelected(),
            onCheckedChange: (value) => row.toggleSelected(!!value),
            'aria-label': 'Select row',
          }),
      },
      { accessorFn: (row) => row.from.iata ?? row.from.code, header: 'Origin' },
      {
        accessorFn: (row) => row.to.iata ?? row.to.code,
        header: 'Destination',
      },
      {
        accessorFn: (row) =>
          row.departure
            ? formatAsDateTime(row.departure)
            : formatAsDate(row.date),
        header: 'Departure',
      },
      {
        accessorFn: (row) => (row.arrival ? formatAsDateTime(row.arrival) : ''),
        header: 'Arrival',
      },
      {
        id: 'airline',
        accessorFn: (row) => row.airline,
        header: () => {
          const airlineHeaderSnippet = createRawSnippet(() => ({
            render: () => `<div class="hidden md:block">Airline</div>`,
          }));
          return renderSnippet(airlineHeaderSnippet, '');
        },
        cell: ({ row }) => {
          const amountCellSnippet = createRawSnippet<[string]>((getAirline) => {
            const airline = getAirline();
            return {
              render: () =>
                `<div class="hidden md:block">${airline ?? ''}</div>`,
            };
          });

          return renderSnippet(amountCellSnippet, row.getValue('airline'));
        },
      },
    ],
    onRowSelectionChange: (updater) => {
      if (typeof updater === 'function') {
        rowSelection = updater(rowSelection);
      } else {
        rowSelection = updater;
      }
    },
    state: {
      get rowSelection() {
        return rowSelection;
      },
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const deleteFlights = async () => {
    const selectedRows = table
      .getRowModel()
      .rows.filter((row) => row.getIsSelected());
    const flightIds = selectedRows.map((row) => row.original.id);
    await api.flight.deleteMany.mutate(flightIds);
    await invalidateAll();
    toast.success('Flights deleted.');
  };
</script>

<div class="container h-full flex flex-col items-center justify-center gap-2">
  <h1 class="text-2xl font-medium">Remove Duplicates</h1>
  <p class="text-sm text-muted-foreground pb-8">
    All of these already exist in the database, with the same origin,
    destination, and date.
  </p>
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <Table.Row>
            {#each headerGroup.headers as header (header.id)}
              <Table.Head>
                {#if !header.isPlaceholder}
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row data-state={row.getIsSelected() && 'selected'}>
            {#each row.getVisibleCells() as cell (cell.id)}
              <Table.Cell>
                <FlexRender
                  content={cell.column.columnDef.cell}
                  context={cell.getContext()}
                />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={6} class="h-12 text-center">
              No duplicates found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
  <Button
    onclick={deleteFlights}
    disabled={!table.getRowModel().rows.some((row) => row.getIsSelected())}
    >Delete Flights
  </Button>
</div>
