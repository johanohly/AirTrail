<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import ShareFormFields from './ShareFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import { shareSchema } from '$lib/zod/share';
  import { TextTooltip } from '$lib/components/ui/tooltip/index.js';

  interface Share {
    id: number;
    slug: string;
    expiresAt?: Date;
    createdAt: Date;
    showMap: boolean;
    showStats: boolean;
    showFlightList: boolean;
    dateFrom?: string;
    dateTo?: string;
    showFlightNumbers: boolean;
    showAirlines: boolean;
    showAircraft: boolean;
    showTimes: boolean;
    showDates: boolean;
  }

  const { share }: { share: Share } = $props();

  let open = $state(false);

  // Convert share data to form format
  const shareFormData = {
    id: share.id,
    slug: share.slug,
    expiresAt: share.expiresAt
      ? new Date(share.expiresAt).toISOString().slice(0, 16)
      : '',
    expiryOption: share.expiresAt ? ('custom' as const) : ('never' as const),
    showMap: share.showMap,
    showStats: share.showStats,
    showFlightList: share.showFlightList,
    dateFrom: share.dateFrom || '',
    dateTo: share.dateTo || '',
    showFlightNumbers: share.showFlightNumbers,
    showAirlines: share.showAirlines,
    showAircraft: share.showAircraft,
    showTimes: share.showTimes,
    showDates: share.showDates,
  };

  const form = superForm(
    defaults<Infer<typeof shareSchema>>(shareFormData, zod(shareSchema)),
    {
      dataType: 'json',
      validators: zod(shareSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.share.list.utils.invalidate();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance } = form;
</script>

<TextTooltip content="Edit share">
  <Button variant="outline" size="icon" onclick={() => (open = true)}>
    <SquarePen size={16} />
  </Button>
</TextTooltip>

<Modal bind:open dialogOnly>
  <h2 class="text-lg font-medium">Edit Share</h2>
  <form
    method="POST"
    action="/api/share/save/form"
    class="grid gap-4"
    use:enhance
  >
    <ShareFormFields {form} />
    <Form.Button>Update</Form.Button>
  </form>
</Modal>
