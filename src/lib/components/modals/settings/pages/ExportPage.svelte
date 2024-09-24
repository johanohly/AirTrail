<script lang="ts">
  import { PageHeader } from '.';
  import { api } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import { FileDown } from '@o7/icon/lucide';
  import { Card } from '$lib/components/ui/card';
  import { toast } from 'svelte-sonner';

  const exportFlights = async () => {
    const csv = await api.flight.export.query();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flights.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast.info('Your download should start shortly');
  };
</script>

<PageHeader
  title="Export"
  subtitle="Export your data to a CSV file. Can be used to backup your data or to import it into another account."
>
  <button onclick={exportFlights} class="w-full">
    <Card
      class={cn(
        'cursor-pointer py-12 border-2 border-dashed flex flex-col items-center hover:bg-card-hover dark:hover:bg-dark-2',
      )}
    >
      <FileDown />
      Click to download your data
    </Card>
  </button>
</PageHeader>
