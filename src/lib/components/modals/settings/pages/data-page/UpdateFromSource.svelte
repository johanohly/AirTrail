<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';

  let checkingForUpdates = false;
  const checkForUpdates = async () => {
    checkingForUpdates = true;
  };
</script>

<Card>
  <CardHeader>
    <CardTitle>Airport Source</CardTitle>
    <CardDescription>
      By default, AirTrail uses <a
        href="https://ourairports.com/"
        target="_blank"
        class="underline text-blue-500">OurAirports</a
      > as the source for airport data. If OurAirports updates their data, you can
      in turn update the internal data used by AirTrail here.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Button
      onclick={checkForUpdates}
      disabled={checkingForUpdates}
      variant="outline">Check for updates</Button
    >
  </CardContent>
</Card>
